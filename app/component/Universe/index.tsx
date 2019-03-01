import React from 'react';
import {
    mesh as topoMesh,
    feature as topoFeature,
} from 'topojson';
import * as THREE from 'three';
import debounce from 'lodash/debounce';
import OrbitControl from 'three-orbit-controls';

import cloud from '@/assets/fair_clouds.4k.png';
import { mapTexture } from './utils/mapTexture';

const GLOBE_SIZE = 8;

const wrapperStyle : React.CSSProperties = {
    flex: 1,
    padding: '3px',
    display: 'flex',
    flexDirection: 'column',
};
const innerStyle : React.CSSProperties = {
    flex: 1,
    border: '1px solid #444',
    overflow: 'hidden',
};

const vertex = ([longitude, latitude], radius) => {
    const lambda = longitude * Math.PI / 180;
    const phi = latitude * Math.PI / 180;
    return new THREE.Vector3(
        radius * Math.cos(phi) * Math.cos(lambda),
        radius * Math.sin(phi),
        -radius * Math.cos(phi) * Math.sin(lambda)
    );
};

const wireframe = (multilinestring, radius, material) => {
    const geometry = new THREE.Geometry();
    for (const P of multilinestring.coordinates) {
        for (let p0, p1 = vertex(P[0], radius), i = 1; i < P.length; ++i) {
            geometry.vertices.push(p0 = p1, p1 = vertex(P[i], radius));
        // geometry.faces.push( new THREE.Face3( 0, -1, -2 ) );
        }
    }
    return new THREE.LineSegments(geometry, material);
};

class Universe extends React.Component {

    private content;
    private scene;
    private camera;
    private renderer;
    private control;
    private globe;
    private cloudLayer;

    private resizeHandler = debounce(() => {
        this.camera.aspect = this.content.clientWidth / this.content.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.content.clientWidth, this.content.clientHeight);
    }, 100);

    public componentDidMount() {
        this.init();
        this.renderGlobe();
        this.renderLight();
        this.loadLand();
    }
    public componentWillUnmount() {
        window.removeEventListener('resize', this.resizeHandler);
    }

    public render() {
        return (
            <div style={wrapperStyle}>
                <div ref={this.setContent} style={innerStyle} />
          </div>
        );
    }
    private init = () => {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(30, null, 0.1, 1000);
        this.camera.position.set(40, 0, 0);
        this.camera.lookAt(new THREE.Vector3(0, 0, 0));
        this.renderer = new THREE.WebGLRenderer({alpha: true, antialias: true});
        this.control = new (OrbitControl(THREE))(this.camera, this.renderer.domElement);
        this.control.zoomSpeed = 0.2;
        this.camera.position.z = 1;
        this.renderer.render(this.scene, this.camera);
        this.renderer.setSize(this.content.clientWidth, this.content.clientHeight);
        this.content.appendChild(this.renderer.domElement);
        this.resizeHandler();
        window.addEventListener('resize', this.resizeHandler);
        this.animate();
    }
    private renderLight = () => {
        const light = new THREE.SpotLight(new THREE.Color(0xffffff), 0.6);
        light.penumbra = 1;
        light.angle = 0.4;
        light.castShadow = true;
        this.camera.add(light);
        this.scene.add(this.camera);
        // const sun = new THREE.PointLight(new THREE.Color(0xffffff), 0.5);
        // sun.position.set(40, 0, -40);
        // this.scene.add(sun);
    }
    private renderGlobe = () => {
        const globe = new THREE.SphereGeometry(GLOBE_SIZE, 32, 32);
        const wireFrameGeometry = new THREE.SphereGeometry(GLOBE_SIZE - 0.2, 6, 6);
        const wireLines = new THREE.LineSegments(
            new THREE.WireframeGeometry(wireFrameGeometry),
            new THREE.LineBasicMaterial({
                color: 0x3987c9,
                opacity: 0.1,
                // depthTest: false,
                transparent: true,
            })
        );
        const material = new THREE.MeshLambertMaterial({
            color: 0x003366,
            // opacity: 0.9,
        });
        const tM = new THREE.MeshLambertMaterial({
            opacity: 0.0,
            transparent: true,
        });

        const outerShield = new THREE.Mesh(globe, tM);
        this.globe = new THREE.Mesh(
            new THREE.SphereGeometry(GLOBE_SIZE - 0.3, 32, 32),
            material,
        );
        // this.globe.add(wireLines);
        this.scene.add(this.globe);
        this.scene.add(outerShield);
        this.cloudLayer = outerShield;
    }
    private animate = () => {
        this.control.update();
        requestAnimationFrame(this.animate);
        if (this.globe) {
            this.globe.rotation.y += 0.0007;
            // this.globe.rotation.x += 0.001;
        }
        if (this.cloudLayer) {
            this.cloudLayer.rotation.y += 0.001;
        }
        this.renderer.render(this.scene, this.camera);
    }
    private setContent = ref => this.content = ref;
    private loadLand = async () => {
        // Try some d3 shit
        const world = await (await fetch('https://raw.githubusercontent.com/sghall/webgl-globes/master/data/world.json')).json();
        const countries = topoFeature(world, world.objects.countries);
        const texturCanvas = mapTexture(countries);
        const map = new THREE.Texture(texturCanvas.node());
        const bumpLoader = new THREE.TextureLoader();
        const bumpMap = bumpLoader.load('https://raw.githubusercontent.com/turban/webgl-earth/master/images/elev_bump_4k.jpg');
        map.needsUpdate = true;
        texturCanvas.remove();

        const mapMaterial  = new THREE.MeshPhongMaterial({
            map,
            bumpMap,
            bumpScale: 0.2,
        });
        this.globe.material = mapMaterial;
        const loader = new THREE.TextureLoader();
        const mapOverlay = loader.load('https://raw.githubusercontent.com/turban/webgl-earth/master/images/fair_clouds_4k.png');
        this.cloudLayer.material = new THREE.MeshPhongMaterial({
            map: mapOverlay,
            color: 0xcccccc,
            transparent: true,
            opacity: 1,
            // depthTest: false,
        });
    }
}

export default Universe;
