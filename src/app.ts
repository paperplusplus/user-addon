import fs from 'fs';
import crypto from 'crypto';
import path from 'path';

import * as MRE from '@microsoft/mixed-reality-extension-sdk';
const text2wav = require('text2wav');

const sha256 = (x:string) => crypto.createHash('sha256').update(x, 'utf8').digest('hex');

const geotz = require('geo-tz');
const moment = require('moment-timezone');

import {fetchJSON} from './fetchJSON';
import {GridMenu, Button} from './GUI';
import { Vector2 } from '@microsoft/mixed-reality-extension-sdk';

const API_KEY = process.env['API_KEY'];
const OWNER_NAME = process.env['OWNER_NAME'];

// CONFIGARABLES.
const JOINED_SOUND_DURATION = 4860;
const LEFT_SOUND_DURATION = 3200;
const DELAY_BETWEEN_SOUNDS = 100;

const RADIUS=0.1;

const CELL_WIDTH = 0.1;
const CELL_HEIGHT = 0.1;
const CELL_DEPTH = 0.005;
const CELL_MARGIN = 0.005;
const CELL_SCALE = 1;

const CONTROL_CELL_WIDTH = CELL_WIDTH*2/3;
const CONTROL_CELL_HEIGHT = CELL_HEIGHT/2;
const CONTROL_CELL_DEPTH = 0.005;
const CONTROL_CELL_MARGIN = 0.005;
const CONTROL_CELL_SCALE = 1;

interface playSoundOptions{
    rolloffStartDistance?: number;
    volume?: number;
}

type ItemDescriptor = {
    thumbnailUri: string;
    resourceId: string;
    attachPoint: string;
    scale: {
        x: number;
        y: number;
        z: number;
    };
    rotation: {
        x: number;
        y: number;
        z: number;
    };
    position: {
        x: number;
        y: number;
        z: number;
    };
};

class InventoryMenu extends GridMenu{
    onItemClick(coord: Vector2, name: string){
        console.log(name, 'at', coord.x, coord.y, 'clicked');
    }
}

class ControlMenu extends GridMenu{
    onItemClick(coord: Vector2, name: string){
        console.log(name, 'at', coord.x, coord.y, 'clicked');
    }
}

/**
 * The main class of this app. All the logic goes here.
 */
export default class Inventory {

    // unity
    private context: MRE.Context;
    private baseUrl: string;
    private assets: MRE.AssetContainer;

    private meshId: MRE.Guid;
    private defaultMaterialId: MRE.Guid;
    private highlightMeshId: MRE.Guid;
    private highlightMaterialId: MRE.Guid;
    private planeMeshId: MRE.Guid;

    private controlMeshId: MRE.Guid;
    private controlDefaultMaterialId: MRE.Guid;
    private controlHighlightMeshId: MRE.Guid;
    private controlHighlightMaterialId: MRE.Guid;
    private controlPlaneMeshId: MRE.Guid;


    private joinedSound: MRE.Sound;
    private leftSound: MRE.Sound;

    //debug
    private defaultPlaneMaterialId: MRE.Guid;
    private texture: MRE.Texture;


    // logic
    private ball: Button;
    private menu: InventoryMenu;
    private controlStrip: ControlMenu;

    // data
    private ItemDatabase: { [key: string]: ItemDescriptor } = {};

    // constructor
	constructor(private _context: MRE.Context, private params: MRE.ParameterSet, _baseUrl: string) {
        this.context = _context;
        this.baseUrl = _baseUrl;
        this.assets = new MRE.AssetContainer(this.context);

        this.texture = this.assets.createTexture('pete', {uri: `${this.baseUrl}/pete.jpg`});

        // button
        this.meshId = this.assets.createBoxMesh('btn_mesh', CELL_WIDTH, CELL_HEIGHT, CELL_DEPTH).id;
        this.defaultMaterialId = this.assets.createMaterial('default_btn_material', { color: MRE.Color3.LightGray() }).id;
        this.highlightMeshId = this.assets.createBoxMesh('highlight_mesh', CELL_WIDTH+CELL_MARGIN, CELL_HEIGHT+CELL_MARGIN, CELL_DEPTH/2).id;
        this.highlightMaterialId = this.assets.createMaterial('highlight_btn_material', { color: MRE.Color3.Red() }).id;

        // plane
        this.defaultPlaneMaterialId = this.assets.createMaterial('default_plane_material', { emissiveTextureId: this.texture.id, mainTextureId: this.texture.id }).id;
        this.planeMeshId = this.assets.createPlaneMesh('plane_mesh', CELL_WIDTH, CELL_HEIGHT).id;

        // control
        this.controlMeshId = this.assets.createBoxMesh('control_btn_mesh', CONTROL_CELL_WIDTH, CONTROL_CELL_HEIGHT, CONTROL_CELL_DEPTH).id;
        this.controlDefaultMaterialId = this.assets.createMaterial('control_default_btn_material', { color: MRE.Color3.DarkGray() }).id;
        this.controlHighlightMeshId = this.assets.createBoxMesh('control_highlight_mesh', CONTROL_CELL_WIDTH+CONTROL_CELL_MARGIN, CONTROL_CELL_HEIGHT+CONTROL_CELL_MARGIN, CONTROL_CELL_DEPTH/2).id;
        this.controlHighlightMaterialId = this.assets.createMaterial('control_highlight_btn_material', { color: MRE.Color3.Red() }).id;

        this.controlPlaneMeshId = this.assets.createPlaneMesh('control_plane_mesh', CONTROL_CELL_WIDTH, CONTROL_CELL_HEIGHT).id;


        this.joinedSound = this.assets.createSound('joined', { uri: `${this.baseUrl}/joined.ogg` });
        this.leftSound = this.assets.createSound('left', { uri: `${this.baseUrl}/left.ogg` });

        this.context.onStarted(() => this.init());
        this.context.onUserJoined(user => this.userJoined(user));
        this.context.onUserLeft(user => this.userLeft(user));
	}

	/**
	 * Once the context is "started", initialize the app.
	 */
	private init() {
        this.createBall();
        this.createMenu();
        this.createControlStrip();
    }

    private createControlStrip(){
        let size = this.menu.getMenuSize();
        this.controlStrip = new ControlMenu(this.context, {
            offset: {
                x: RADIUS + size.width + CONTROL_CELL_MARGIN,
                y: RADIUS
            },
            shape: {
                row: 2,
                col: 1
            },
            cell: {
                width: CONTROL_CELL_WIDTH,
                height: CONTROL_CELL_HEIGHT,
                depth: CONTROL_CELL_DEPTH,
                scale: CONTROL_CELL_SCALE
            },
            margin: CELL_MARGIN,
            meshId: this.controlMeshId,
            defaultMaterialId: this.controlDefaultMaterialId,
            highlightMeshId: this.controlHighlightMeshId,
            highlightMaterialId: this.controlHighlightMaterialId,
            planeMeshId: this.controlPlaneMeshId,
            parentId: this.ball._button.id,
            // debug
            defaultPlaneMaterialId: this.defaultPlaneMaterialId
        });
    }

    private createMenu(){
        this.menu = new InventoryMenu(this.context, {
            offset:{
                x: RADIUS,
                y: RADIUS
            },
            shape: {
                row: 4,
                col: 3
            },
            cell: {
                width: CELL_WIDTH,
                height: CELL_HEIGHT,
                depth: CELL_DEPTH,
                scale: CELL_SCALE,
                highlightDepth: CELL_DEPTH/2
            },
            margin: CELL_MARGIN,
            meshId: this.meshId,
            defaultMaterialId: this.defaultMaterialId,
            highlightMeshId: this.highlightMeshId,
            highlightMaterialId: this.highlightMaterialId,
            planeMeshId: this.planeMeshId,
            parentId: this.ball._button.id,
            // debug
            defaultPlaneMaterialId: this.defaultPlaneMaterialId
        });
    }

    private createBall(){
        this.ball = new Button(this.context, {
            position: {x: 0, y: 0, z: 0},
            scale: {x: 1, y: 1, z: 1},
            text: '',
            enabled: true,
            meshId: this.assets.createSphereMesh('ball_mesh', RADIUS).id,
            materialId: this.assets.createMaterial('ball_material', { color: MRE.Color3.LightGray() }).id,
            buttonDepth: 0.1,
            layer: MRE.CollisionLayer.Hologram,
            defaultPlaneMaterialId: this.defaultPlaneMaterialId // debug
        });
        this.ball.addBehavior((user,__) => {
            user.prompt("Text To Speech", true).then((dialog) => {
                if (dialog.submitted) {
                    this.tts(dialog.text);
                }
            });
        });
        
        // Add grab
        let button = this.ball._button;
        button.grabbable = true;
        button.onGrab('end', (user)=>{
            console.log('ended');
            if (this.checkUserName(user, OWNER_NAME)) {
                this.equipBall(user);
            }
        });
    }

    private userJoined(user: MRE.User){
        this.playSound(this.joinedSound, {});
        setTimeout(() => {
            this.greet(user);
        }, JOINED_SOUND_DURATION + DELAY_BETWEEN_SOUNDS);
    }

    private userLeft(user: MRE.User){
        this.playSound(this.leftSound, {});
        setTimeout(() => {
            this.bye(user);
        }, LEFT_SOUND_DURATION + DELAY_BETWEEN_SOUNDS);
    }

    private playSound(musicAsset: MRE.Sound, options?: playSoundOptions){
        let volume = (options.volume == undefined) ? 0.7 : options.volume;
        let rolloffStartDistance = (options.rolloffStartDistance == undefined) ? 15 : options.rolloffStartDistance;
        this.ball._button.startSound(musicAsset.id, {
            volume,
            rolloffStartDistance,
            looping: false
        });
    }

    private parseUser(user: MRE.User){
        let ra = user.properties['remoteAddress'];
        let ipv4 = ra.split(':').pop();
        return {
            id: user.id,
            name: user.name,
            device: user.properties['device-model'],
            ip: ipv4
        }
    }

    private async ip2location(ip: string){
        console.log(`http://api.ipapi.com/${ip}?access_key=${API_KEY}`);
        const res = await fetchJSON(`http://api.ipapi.com/${ip}?access_key=${API_KEY}`);
        return {
            lat: res.latitude,
            lng: res.longitude,
            cc: res.country_code,
            country: res.country_name
        }
    }

    private async greet(user: MRE.User){
        let u = this.parseUser(user);
        console.log(u);

        let name = u.name;
        let loc = await this.ip2location(u.ip);
        console.log(loc);

        let tz;
        if (isNaN(loc.lat) && isNaN(loc.lng) || loc.lat==null && loc.lng==null){
            tz = 'Asia/Shanghai';
        } else{
            tz = geotz(loc.lat, loc.lng)[0];
        }
        let hour = moment.tz(tz).hour();
        let greet = "Good " + (hour>=4 && hour<12 && "Morning" || hour>=12 && hour<18 && "Afternoon" || "Evening");

        this.tts(`${greet}, ${name}, welcome to the spaceship`);
    }

    private bye(user: MRE.User){
        let u = this.parseUser(user);

        let name = u.name;
        this.tts(`${name} has left the spaceship`);
    }

    private async tts(text: string){
        let fileName = sha256(text) + '.wav';
        let filePath = path.join(__dirname, '../public/', fileName);
        console.log(text);
        let o;
        try{
            o = await text2wav(text);
        }catch(err){
            console.log(err);
            return;
        }
        fs.writeFile(filePath, Buffer.from(o), (err) => {
            if(err){ console.log(err);}
            const sound = this.assets.createSound(fileName, { uri: `${this.baseUrl}/${fileName}` });
            this.playSound(sound, {});
        });
    }

    private checkUserName(user: MRE.User, name: string){
        console.log(user.name, name);
        return user.name == name;
    }

    private equipBall(user: MRE.User){
        this.ball._button.attach(user, 'left-hand');
    }
}
