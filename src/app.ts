import fs from 'fs';
import crypto from 'crypto';
import path from 'path';

import * as MRE from '@microsoft/mixed-reality-extension-sdk';
const text2wav = require('text2wav');

const sha256 = (x:string) => crypto.createHash('sha256').update(x, 'utf8').digest('hex');

const geotz = require('geo-tz');
const moment = require('moment-timezone');
3
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

// Main Menu
const MAIN_MENU_ITEMS = ['Inventory', 'SoundBoard', 'TTS', 'Lock'];
const MAIN_MENU_CELL_WIDTH = 0.3;
const MAIN_MENU_CELL_HEIGHT = 0.1;
const MAIN_MENU_CELL_DEPTH = 0.005;
const MAIN_MENU_CELL_MARGIN = 0.01;
const MAIN_MENU_CELL_SCALE = 1;

// Inventory
const CELL_WIDTH = 0.1;
const CELL_HEIGHT = 0.1;
const CELL_DEPTH = 0.005;
const CELL_MARGIN = 0.005;
const CELL_SCALE = 1;

const INVENTORY_CONTROL_ITEMS = ['Next', 'Prev', 'Equip', 'Clear', 'Back'];
const CONTROL_CELL_WIDTH = CELL_WIDTH*2/3;
const CONTROL_CELL_HEIGHT = CELL_HEIGHT/2;
const CONTROL_CELL_DEPTH = 0.005;
const CONTROL_CELL_MARGIN = 0.005;
const CONTROL_CELL_SCALE = 1;
const CONTROL_CELL_TEXT_HEIGHT = 0.02;

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

class MainMenu extends GridMenu{
    onItemClick(coord: Vector2, name: string, user: MRE.User){
        if (this.app.scene != 'main_menu') return;

        let row = coord.x;
        switch(row){
            case MAIN_MENU_ITEMS.indexOf('Inventory'):
                this.app.switchScene('inventory_menu');
                break;
            case MAIN_MENU_ITEMS.indexOf('SoundBoard'):
                break;
            case MAIN_MENU_ITEMS.indexOf('TTS'):
                user.prompt("Text To Speech", true).then((dialog) => {
                    if (dialog.submitted) {
                        this.app.tts(dialog.text);
                    }
                });
                break;
            case MAIN_MENU_ITEMS.indexOf('Lock'):
                this.highlight(coord);
                break;
        }
    }
}

class InventoryMenu extends GridMenu{
    onItemClick(coord: Vector2, name: string, user: MRE.User){
        if (this.app.scene != 'inventory_menu') return;
        this.highlight(coord);
        console.log(name);
    }
}

class ControlMenu extends GridMenu{
    onItemClick(coord: Vector2, name: string, user: MRE.User){
        if (this.app.scene != 'inventory_menu') return;

        let row = coord.x;
        switch(row){
            case INVENTORY_CONTROL_ITEMS.indexOf('Next'):
                break;
            case INVENTORY_CONTROL_ITEMS.indexOf('Prev'):
                break;
            case INVENTORY_CONTROL_ITEMS.indexOf('Equip'):
                break;
            case INVENTORY_CONTROL_ITEMS.indexOf('Clear'):
                break;
            case INVENTORY_CONTROL_ITEMS.indexOf('Back'):
                this.app.switchScene('main_menu');
                break;
        }
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

    private mainMenuMeshId: MRE.Guid;
    private mainMenuDefaultMaterialId: MRE.Guid;
    private mainMenuHighlightMeshId: MRE.Guid;
    private mainMenuHighlightMaterialId: MRE.Guid;

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
    private mainMenu: MainMenu;
    private inventoryMenu: InventoryMenu;
    private inventoryControlStrip: ControlMenu;

    private scenes: Array<[string, GridMenu[]]> = [];
    private currentScene: string = '#';
    private prevScene: string = 'main_menu';

    // data
    private ItemDatabase: { [key: string]: ItemDescriptor } = {};

    // get
    get scene() { return this.currentScene; }

    // constructor
	constructor(private _context: MRE.Context, private params: MRE.ParameterSet, _baseUrl: string) {
        this.context = _context;
        this.baseUrl = _baseUrl;
        this.assets = new MRE.AssetContainer(this.context);

        this.texture = this.assets.createTexture('pete', {uri: `${this.baseUrl}/pete.jpg`});

        // mainmenu button
        this.mainMenuMeshId = this.assets.createBoxMesh('main_menu_btn_mesh', MAIN_MENU_CELL_WIDTH, MAIN_MENU_CELL_HEIGHT, MAIN_MENU_CELL_DEPTH).id;
        this.mainMenuDefaultMaterialId = this.assets.createMaterial('main_menu_default_btn_material', { color: MRE.Color3.LightGray() }).id;
        this.mainMenuHighlightMeshId = this.assets.createBoxMesh('main_menu_highlight_mesh', MAIN_MENU_CELL_WIDTH+MAIN_MENU_CELL_MARGIN, MAIN_MENU_CELL_HEIGHT+MAIN_MENU_CELL_MARGIN, CELL_DEPTH/2).id;
        this.mainMenuHighlightMaterialId = this.assets.createMaterial('main_menu_highlight_btn_material', { color: MRE.Color3.Red() }).id;

        // inventory button
        this.meshId = this.assets.createBoxMesh('btn_mesh', CELL_WIDTH, CELL_HEIGHT, CELL_DEPTH).id;
        this.defaultMaterialId = this.assets.createMaterial('default_btn_material', { color: MRE.Color3.LightGray() }).id;
        this.highlightMeshId = this.assets.createBoxMesh('highlight_mesh', CELL_WIDTH+CELL_MARGIN, CELL_HEIGHT+CELL_MARGIN, CELL_DEPTH/2).id;
        this.highlightMaterialId = this.assets.createMaterial('highlight_btn_material', { color: MRE.Color3.Red() }).id;

        // inventory plane
        this.defaultPlaneMaterialId = this.assets.createMaterial('default_plane_material', { emissiveTextureId: this.texture.id, mainTextureId: this.texture.id }).id;
        this.planeMeshId = this.assets.createPlaneMesh('plane_mesh', CELL_WIDTH, CELL_HEIGHT).id;

        // inventory control
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

        // main menu
        this.createMainMenu();

        // inventory menu
        this.createInventoryMenu();
        this.createInventoryMenuControlStrip();

        // TODOS: soundboard menu

        // scenes
        this.scenes.push(['main_menu', [this.mainMenu]]);
        this.scenes.push(['inventory_menu', [this.inventoryMenu, this.inventoryControlStrip]]);

        this.switchScene(''); // start from main menu
    }

    public switchScene(scene: string){
        if (this.currentScene == scene){
            return;
        }
        // default scene
        if (!this.scene.length && !this.scenes.map(e=>e[0]).includes(scene)) {
            scene = 'main_menu';
        }
        this.currentScene = scene;
        this.scenes.forEach((e)=>{
            let k = e[0]; let v = e[1];
            v.forEach(m => {
                if (k == scene){
                    m.enable();
                }else{
                    m.disable();
                }
            });
        });
    }

    private createMainMenu(){
        let data = MAIN_MENU_ITEMS.map(t => [{
            text: t
        }]);
        this.mainMenu = new MainMenu(this.context, this, {
            offset: {
                x: RADIUS,
                y: RADIUS
            },
            shape: {
                row: 4,
                col: 1
            },
            cell: {
                width: MAIN_MENU_CELL_WIDTH,
                height: MAIN_MENU_CELL_HEIGHT,
                depth: MAIN_MENU_CELL_DEPTH,
                scale: MAIN_MENU_CELL_SCALE
            },
            margin: MAIN_MENU_CELL_MARGIN,
            meshId: this.mainMenuMeshId,
            defaultMaterialId: this.mainMenuDefaultMaterialId,
            highlightMeshId: this.mainMenuHighlightMeshId,
            highlightMaterialId: this.mainMenuHighlightMaterialId,
            parentId: this.ball._button.id,
            data
        });
    }

    private createInventoryMenuControlStrip(){
        let data = INVENTORY_CONTROL_ITEMS.map(t => [{
            text: t
        }]);
        let size = this.inventoryMenu.getMenuSize();
        this.inventoryControlStrip = new ControlMenu(this.context, this, {
            offset: {
                x: RADIUS + size.width + CONTROL_CELL_MARGIN,
                y: RADIUS
            },
            shape: {
                row: 5,
                col: 1
            },
            cell: {
                width: CONTROL_CELL_WIDTH,
                height: CONTROL_CELL_HEIGHT,
                depth: CONTROL_CELL_DEPTH,
                scale: CONTROL_CELL_SCALE,
                textHeight: CONTROL_CELL_TEXT_HEIGHT
            },
            margin: CELL_MARGIN,
            meshId: this.controlMeshId,
            defaultMaterialId: this.controlDefaultMaterialId,
            highlightMeshId: this.controlHighlightMeshId,
            highlightMaterialId: this.controlHighlightMaterialId,
            planeMeshId: this.controlPlaneMeshId,
            parentId: this.ball._button.id,
            data
        });
    }

    private createInventoryMenu(){
        this.inventoryMenu = new InventoryMenu(this.context, this, {
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
            // user.prompt("Text To Speech", true).then((dialog) => {
            //     if (dialog.submitted) {
            //         this.tts(dialog.text);
            //     }
            // });
            this.toggleMenu();
        });
        
        // Add grab
        let button = this.ball._button;
        button.grabbable = true;
        button.onGrab('end', (user)=>{
            if (this.checkUserName(user, OWNER_NAME)) {
                this.equipBall(user);
            }
        });
    }

    private toggleMenu(){
        if (this.currentScene == ''){
            this.switchScene(this.prevScene);
        } else{
            this.prevScene = this.currentScene;
            this.switchScene('');
        }
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

    public async tts(text: string){
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
        return user.name == name;
    }

    private equipBall(user: MRE.User){
        this.ball._button.attach(user, 'left-hand');
    }
}
