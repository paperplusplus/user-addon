import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
const sha256 = (x:string) => crypto.createHash('sha256').update(x, 'utf8').digest('hex');

import * as MRE from '@microsoft/mixed-reality-extension-sdk';
import { Vector2, Vector3 } from '@microsoft/mixed-reality-extension-sdk';
const cloneDeep = require('clone-deep');

import { GridMenu } from './GUI/gridMenu';
import { Button } from './GUI/button';
import { ItemDescriptor, DadJoke, getJoke, JOKE_TYPE, Meme, MemeCrawler } from './database';

import { checkUserName } from './utils';
import { tts, greet, bye } from './tts';

const OWNER_NAME = process.env['OWNER_NAME'];

const RADIUS=0.1;

interface playSoundOptions{
    rolloffStartDistance?: number;
    volume?: number;
}

type UserStats = {
    hp: number,
    attack: number,
    defense: number,
    coins: number
}

const EQUIPMENT_ITEMS = ['Helmet', 'Armor', 'Weapon', 'Ring'];

/**
 * The main class of this app. All the logic goes here.
 */
export class AltRPG {
    private context: MRE.Context;
    private baseUrl: string;
    private assets: MRE.AssetContainer;

    // global assets
    private joinedSound: MRE.Sound;
    private leftSound: MRE.Sound;
    private defaultPlaneMaterial: MRE.Material;
    // cache
    private textures: Map<string, MRE.Texture>;
    private materials: Map<string, MRE.Material>;
    private sounds: Map<string, MRE.Sound>;
    private playing: Map<string, MRE.MediaInstance>;


    // ball
    private ball: Button;
    private root: MRE.Actor;

    // camera & mirror
    private camera: MRE.Actor;
    private mirror: MRE.Actor;

    // main_menu scene
    private mainMenu: GridMenu;
    private mainMenuControlStrip: GridMenu;

    // inventory_menu scene
    private inventoryMenu: GridMenu;
    private inventoryControlStrip: GridMenu;
    private infoPanel: GridMenu;
    private equipmentMenu: GridMenu;
    private userStatsPanel: GridMenu;

    // shop_menu scene
    private shopMenu: GridMenu;
    private shopMenuInfoPanel: GridMenu;
    private shopMenuControlStrip: GridMenu;
    private shopInventoryControlStrip: GridMenu;

    // tools_menu scene
    private toolsMenu: GridMenu;

    // bdj_menu scene
    private BDJMenu: GridMenu;
    private BDJMenuControlStrip: GridMenu;

    // soundboard scene
    private soundboardMenu: GridMenu;
    private soundboardMenuControlStrip: GridMenu;

    // scene states
    private scenes: Array<[string, GridMenu[]]> = [];
    private currentScene: string = '#';
    private prevScene: string = 'main_menu';

    // game data
    private itemDatabase: ItemDescriptor[];
    private userItems: ItemDescriptor[];
    private userEquipments: ItemDescriptor[];
    private itemIdToItem: Map<number, ItemDescriptor> = new Map<number, ItemDescriptor>();
    private equippedItems: Map<number, MRE.Actor> = new Map<number, MRE.Actor>();
    private userStats: UserStats;

    private dadJoke: DadJoke[] = [{
        id: 0,
        type: JOKE_TYPE.GENERAL,
        setup: 'hello',
        punchline: 'world'
    }];

    private memesDatabase: Meme[];
    private memes: Meme[];

    // constructor
	constructor(private _context: MRE.Context, private params: MRE.ParameterSet, _baseUrl: string) {
        this.context = _context;
        this.baseUrl = _baseUrl;
        this.assets = new MRE.AssetContainer(this.context);

        // repetition check for texture reuse
        this.textures = new Map<string, MRE.Texture>();
        this.materials = new Map<string, MRE.Material>();
        this.sounds = new Map<string, MRE.Sound>();
        this.playing = new Map<string, MRE.MediaInstance>();

        // init
        this.context.onStarted(() => this.init());

        // user join & left
        this.context.onUserJoined(user => this.userJoined(user));
        this.context.onUserLeft(user => this.userLeft(user));
	}

	/**
	 * Once the context is "started", initialize the app.
	 */
	private init() {
        // data
        this.loadData();

        // sounds & default plane material for menus
        this.loadSounds();
        this.defaultPlaneMaterial = this.assets.createMaterial('default_btn_material', { color: MRE.Color3.DarkGray() });

        // ball        
        this.createBall();

        // menus for main_menu scene
        this.createMainMenu();
        this.createMainMenuControlStrip();

        // menus for inventory_menu scene
        this.createInventoryMenu();
        this.createInventoryMenuControlStrip();
        this.createInfoPanel();
        this.createEquipmentMenu();
        this.createUserStatsPanel();
        this.updateMenuPage( this.inventoryMenu, this.getInventoryPageData(), (d:ItemDescriptor) => d.count.toString() );
        this.updateMenuPage( this.equipmentMenu, this.userEquipments, (d:ItemDescriptor) => d.type );

        // menus for shop_menu scene
        this.createShopMenu();
        this.createShopMenuInfoPanel();
        this.createShopMenuControlStrip();
        this.createShopInventoryControlStrip();
        this.updateMenuPage( this.shopMenu, this.getShopPageData() );

        // menus for tools_menu scene
        this.createToolsMenu();

        // menus for bdj_menu scene
        this.createBDJMenu();
        this.createBDJMenuControlStrip();
        this.updateBDJ(JOKE_TYPE.GENERAL);

        // menus for soundboard_menu scene
        this.createSoundboardMenu();
        this.createSoundboardMenuControlStrip();
        this.updateSoundboard( this.getMemePageData() );

        // scenes
        this.scenes.push(['main_menu', [this.mainMenu, this.mainMenuControlStrip]]);
        this.scenes.push(['inventory_menu', [this.inventoryMenu, this.inventoryControlStrip, this.infoPanel, this.equipmentMenu, this.userStatsPanel]]);
        this.scenes.push(['shop_menu', [this.shopMenu, this.shopMenuControlStrip, this.shopMenuInfoPanel, this.inventoryMenu, this.shopInventoryControlStrip, this.infoPanel ]]);
        this.scenes.push(['tools_menu', [this.toolsMenu]]);
        this.scenes.push(['bdj_menu', [this.BDJMenu, this.BDJMenuControlStrip]]);
        this.scenes.push(['soundboard_menu', [this.soundboardMenu, this.soundboardMenuControlStrip]]);

        // hide menus on game start up
        this.switchScene('');
    }

    private loadSounds(){
        // sounds
        this.joinedSound = this.assets.createSound('joined', { uri: `${this.baseUrl}/joined.ogg` });
        this.leftSound = this.assets.createSound('left', { uri: `${this.baseUrl}/left.ogg` });
    }


    private userJoined(user: MRE.User){
        const JOINED_SOUND_DURATION = 4860;
        const DELAY_BETWEEN_SOUNDS = 100;

        if (checkUserName(user, OWNER_NAME)){
            this.createMirror(user);
        }
        this.playSoundWithBall(this.joinedSound, {volume: 0.1});
        setTimeout(() => {
            greet(user);
        }, JOINED_SOUND_DURATION + DELAY_BETWEEN_SOUNDS);
    }

    private userLeft(user: MRE.User){
        const LEFT_SOUND_DURATION = 3200;
        const DELAY_BETWEEN_SOUNDS = 100;
        if (checkUserName(user, OWNER_NAME)){
            if (this.ball._button.attachment !== undefined) this.ball._button.detach();
            if (this.mirror.attachment !== undefined) { this.mirror.detach(); this.mirror.destroy();}
            if (this.camera.attachment !== undefined) { this.camera.detach(); this.camera.destroy();}
        }
        this.playSoundWithBall(this.leftSound, {volume: 0.1});
        setTimeout(() => {
            bye(user);
        }, LEFT_SOUND_DURATION + DELAY_BETWEEN_SOUNDS);
    }

    //////////////
    //// scenes
    private switchScene(scene: string){
        if (this.currentScene == scene){
            return;
        }
        // default scene
        if (!this.currentScene.length && !this.scenes.map(e=>e[0]).includes(scene)) {
            scene = 'main_menu';
        }
        this.currentScene = scene;
        // disable other scenes first
        let tv: GridMenu[] = [];
        this.scenes.forEach((e)=>{
            let k = e[0]; let v = e[1];
            v.forEach(m => {
                if (k != scene){
                    m.disable();
                }
                else{
                    tv = v;
                }
            });
        });
        // then enable current scene
        tv.forEach(m => {
            m.enable();
        })
    }

    ////////////////////
    //// material
    private loadMaterial(name: string, uri: string){
        let texture;
        if (!this.textures.has('texture_'+name)){
            texture = this.assets.createTexture('texture_'+name, {uri});
            this.textures.set('texture_'+name, texture);
        }else{
            texture = this.textures.get('texture_'+name);
        }

        let material;
        if(!this.materials.has('material_'+name)){
            material = this.assets.createMaterial('material_'+name, { mainTextureId: texture.id });
            this.materials.set('material_'+name, material);
        }else{
            material = this.materials.get('material_'+name);
        }
        return material;
    }

    /////////////////////
    //// sound
    private loadSound(name: string, uri: string){
        let sound
        if(!this.sounds.has('sound_'+name)){
            sound = this.assets.createSound(name, { uri });
            this.sounds.set('sound_'+name, sound);
        }else{
            sound = this.sounds.get('sound_'+name);
        }
        return sound;
    }

    /////////////////
    //// data
    private async loadData(){
        this.itemDatabase = require('../public/data/items.json');
        this.userItems = [];
        this.userEquipments = EQUIPMENT_ITEMS.map(e => ({
            name: e,
            id: 0,
            type: e
        }));

        this.userStats = {
            hp: 100,
            attack: 100,
            defense: 100,
            coins: 100
        }

        this.memesDatabase = require('../public/data/memes.json');
        this.memes = this.memesDatabase;
    }

    private getItemDescription(item: ItemDescriptor){
        if (item.id == 0){ return item.type }
        let stat = (item.attack !== undefined) ? `attack: ${item.attack}` : `defense: ${item.defense}`
        let desc = 
       `name: ${item.name}
       count: ${item.count}
       cost: ${item.cost}
       ${stat}`;
       return desc;
    }

    private getShopPageData(){
        let pageSize = this.shopMenu.row * this.shopMenu.col;
        return this.itemDatabase.slice(pageSize*(this.shopMenu.curPageNum-1), pageSize*this.shopMenu.curPageNum);
    }

    private getInventoryPageData(){
        let pageSize = this.inventoryMenu.row * this.inventoryMenu.col;
        return this.userItems.slice(pageSize*(this.inventoryMenu.curPageNum-1), pageSize*this.inventoryMenu.curPageNum);
    }

    private async getBDJData(type: JOKE_TYPE){
        this.dadJoke = await getJoke(type);
    }

    private searchMeme(search: string = ''){
        if(!search.length){
            this.memes = this.memesDatabase;
        }else{
            this.memes = this.memesDatabase.filter(d => d.name.toLowerCase().includes(search));
        }
    }

    private getMemePageData(){
        let pageSize = this.soundboardMenu.row * this.soundboardMenu.col;
        return this.memes.slice(pageSize*(this.soundboardMenu.curPageNum-1), pageSize*this.soundboardMenu.curPageNum);
    }

    private addItemToInventory(item: ItemDescriptor){
        if (!this.itemIdToItem.has(item.id)){
            let it = cloneDeep(item)
            this.userItems.push(it);
            this.itemIdToItem.set(item.id, it);
        }else{
            this.itemIdToItem.get(item.id).count += 1;
        }
    }

    private removeItemFromInventory(index: number){
        let item = this.userItems[index];
        if (item === undefined) {return}
        item.count -= 1;
        if (item.count <= 0){
            this.itemIdToItem.delete(item.id);
            return this.userItems.splice(index, 1)[0];
        }
        return item;
    }

    ////////////////////
    // actions
    private updateShopItemDescription(index: number){
        let item = this.itemDatabase[index];
        if (item === undefined) {return}
        let stat = (item.attack !== undefined) ? `attack: ${item.attack}` : `defense: ${item.defense}`
        let desc = 
       `
       name: ${item.name}
       cost: ${item.cost}
       ${stat}
       `;
        this.shopMenuInfoPanel.updateCells([[{text: desc}]]);
    }

    private updateInventoryItemDescription(index: number){
        let item = this.userItems[index];
        if (item === undefined) {return}

        let desc = this.getItemDescription(item);
        this.infoPanel.updateCells([[{text: desc}]]);
    }

    private updateMenuPage(menu: GridMenu, pageData: ItemDescriptor[], desc?: (d: ItemDescriptor, i?: number) => string){
        let f = (desc !== undefined) ? desc : (d:ItemDescriptor)=>d.name;
        let data = pageData.map(d => ({
            text: f(d),
            material: (d.obj !== undefined) ? this.loadMaterial(d.name, d.obj.thumbnailUri) : this.defaultPlaneMaterial
        }));
        menu.updateCells(menu.reshape(data));
    }

    private lineBreak(text: string, break_len: number =28){
        let ret = '';
        ret += text.slice(0, break_len);
        for (let i=1; i*break_len<text.length; i++){
            ret += '\n-' + text.slice(i*break_len, (i+1)*break_len);
        }
        return ret;
    }

    private async updateBDJ(type: JOKE_TYPE){
        await this.getBDJData(type);
        let dj = this.dadJoke[0];
        let data = [
            {text: this.lineBreak(dj.setup)},
            {text: this.lineBreak(dj.punchline)},
        ];
        this.BDJMenu.updateCells(this.BDJMenu.reshape(data));
        console.log(this.dadJoke);
    }

    private updateSoundboard(pageData: Meme[]){
        let data = pageData.map(d => ({
            text: this.lineBreak(d.name, 10)
        }));
        this.soundboardMenu.updateCells(this.soundboardMenu.reshape(data));
    }

    private buyItem(index: number){
        let item = this.itemDatabase[index];
        if (item === undefined) {return}
        if (this.userStats.coins < item.cost){
            this.shopMenuInfoPanel.updateCells([[{text: 'Insufficient funds'}]]);
        } else {
            this.userStats.coins -= item.cost;
            this.addItemToInventory(item);
            this.shopMenuInfoPanel.updateCells([[{text: `${item.name} added`}]]);
        }
    }

    private sellItem(index: number){
        let item = this.removeItemFromInventory(index);
        if (item) this.userStats.coins += item.cost;
    }

    private equipItem(index: number, user: MRE.User){
        let item = cloneDeep(this.removeItemFromInventory(index));
        if (item) {
            let i = EQUIPMENT_ITEMS.indexOf(item.type);
            if (i >= 0 && i <= this.userEquipments.length) {
                // put back equipped
                let prev = this.userEquipments[i];
                if( prev.id != 0 ) {
                    this.addItemToInventory(prev);
                    this.stripEquipment(prev);
                }
                // replace with new item
                item.count = 1;
                this.userEquipments[i] = item;
                this.wearEquipment(item, user);
            }
        }
    }

    private removeItem(index: number){
        let item = this.userEquipments[index];
        if (item === undefined || item.id == 0) { return; }
        this.addItemToInventory(item);

        let dummy = {
            name: EQUIPMENT_ITEMS[index],
            id: 0,
            type: EQUIPMENT_ITEMS[index]
        }
        this.userEquipments[index] = dummy;
        this.stripEquipment(item);
    }

    private wearEquipment(item: ItemDescriptor, user: MRE.User){
        const position = item.obj.position ? item.obj.position : { x: 0, y: 0.5, z: 0 }
        const scale = item.obj.scale ? item.obj.scale : { x: 0.5, y: 0.5, z: 0.5 }
        const rotation = item.obj.rotation ? item.obj.rotation : { x: 0, y: 180, z: 0 }
        const attachPoint = <MRE.AttachPoint> (item.obj.attachPoint ? item.obj.attachPoint : 'head')

        let actor = MRE.Actor.CreateFromLibrary(this.context, {
            resourceId: item.obj.resourceId,
            actor: {
                transform: {
                    local: {
                        position: position,
                        rotation: MRE.Quaternion.FromEulerAngles(
                            rotation.x * MRE.DegreesToRadians,
                            rotation.y * MRE.DegreesToRadians,
                            rotation.z * MRE.DegreesToRadians),
                        scale: scale
                    }
                }
            }
        });
        actor.attach(user, attachPoint);
        this.equippedItems.set(item.id, actor);
    }

    private stripEquipment(item: ItemDescriptor){
        if (this.equippedItems.has(item.id)){
            let actor = this.equippedItems.get(item.id).destroy();
            this.equippedItems.delete(item.id);
        }
    }

    private playMeme(index: number){
        let item = this.memes[index];
        if (item === undefined) {return;}
        let uri = `${this.baseUrl}/data/${path.basename(item.uri)}`;
        console.log(uri);
        let sound = this.loadSound(item.name, uri);
        let mediaInstance = this.playSoundWithBall(sound, {volume: 0.05, rolloffStartDistance: 1});
        this.playing.set('sound_'+item.name, mediaInstance);
        setTimeout(()=>{ 
            this.playing.delete('sound_'+item.name);
        }, item.duration*1000);
    }

    private stopMemes(){
        this.playing.forEach(m => {m.stop()})
    }

    /////////////////
    //// ball
    private createBall(){
        this.ball = new Button(this.context, {
            position: {x: 0, y: 0, z: 0},
            scale: {x: 1, y: 1, z: 1},
            text: '',
            enabled: true,
            meshId: this.assets.createSphereMesh('ball_mesh', RADIUS*0.6).id,
            materialId: this.assets.createMaterial('ball_material', { color: MRE.Color3.LightGray() }).id,
            layer: MRE.CollisionLayer.Hologram
        });
        this.root = MRE.Actor.Create(this.context, {
            actor:{ 
                transform: { 
                    local: { position: {x: 0, y: 0, z: 0} }
                },
                parentId: this.ball._button.id
            },
        });
        this.ball.addBehavior((user,__) => {
            if (checkUserName(user, OWNER_NAME)){
                this.toggleMenu();
            }else{
            }
        });
        
        // Add grab
        let button = this.ball._button;
        button.grabbable = true;
        button.onGrab('end', (user)=>{
            if (checkUserName(user, OWNER_NAME)) {
                console.log(this.ball._button.attachment);
                if (this.ball._button.attachment === undefined || this.ball._button.attachment.attachPoint == 'none'){
                    this.equipBall(user);
                }
            }
        });

        // subscribe
        button.subscribe('transform');
    }

    private async textToSpeech(text: string){
        let fileName = sha256(text) + '.wav';
        let filePath = path.join(__dirname, '../public/', fileName);
        let o = await tts(text);
        fs.writeFile(filePath, Buffer.from(o), (err) => {
            if(err){ console.log(err);}
            const sound = this.assets.createSound(fileName, { uri: `${this.baseUrl}/${fileName}` });
            this.playSoundWithBall(sound, {});
        });
    }

    private playSoundWithBall(musicAsset: MRE.Sound, options: playSoundOptions){
        if(musicAsset === undefined) { return; }
        let volume = (options.volume === undefined) ? 0.5 : options.volume;
        let rolloffStartDistance = (options.rolloffStartDistance === undefined) ? 15 : options.rolloffStartDistance;
        return this.ball._button.startSound(musicAsset.id, {
            volume,
            rolloffStartDistance,
            looping: false
        });
    }

    private equipBall(user: MRE.User){
        let tr = new MRE.ScaledTransform();
        this.ball.updateLocalTransform(tr);

        this.ball._button.attach(user, 'left-hand');
    }

    private unEquipBall(){
        if (this.ball._button.attachment !== undefined) {
            this.ball._button.detach();

            let tr = new MRE.ScaledTransform();
            tr.position = this.ball._button.transform.app.position;
            tr.rotation = this.ball._button.transform.app.rotation;
            this.ball.updateLocalTransform(tr);
        }
    }

    private lockBall(){
        this.ball._button.grabbable = false;
    }

    private unlockBall(){
        this.ball._button.grabbable = true;
    }

    ////////////////////
    //// mirror
    private createMirror(user: MRE.User){
        const MIRROR_RESOURCE_ID = "artifact:1493621759352505254";
        const MIRROR_SCALE = {x: -0.5, y: -0.5, z: -0.5};
        const MIRROR_POSITION = {
            x: 0, y: 0, z: 5
        }
        const MIRROR_ROTATION = {
            x: -90, y: -180, z: 0
        }
        this.mirror = MRE.Actor.CreateFromLibrary(this.context, {
            resourceId: MIRROR_RESOURCE_ID,
            actor: {
                transform: {
                    local: {
                        position: MIRROR_POSITION,
                        rotation: MRE.Quaternion.FromEulerAngles(
                            MIRROR_ROTATION.x * MRE.DegreesToRadians,
                            MIRROR_ROTATION.y * MRE.DegreesToRadians,
                            MIRROR_ROTATION.z * MRE.DegreesToRadians),
                        scale: MIRROR_SCALE
                    }
                },
                collider: { 
                    geometry: { shape: MRE.ColliderType.Box },
                    layer: MRE.CollisionLayer.Hologram
                }
            }
        });
        this.mirror.attach(user, 'spine-middle');
        this.disableMirror();

        const CAMERA_RESOURCE_ID = "artifact:1493621766818366377";
        const CAMERA_SCALE = {x: 0.2, y: 0.2, z: 0.2};
        const CAMERA_POSITION = {
            x: 0, y: 0.09, z: 2
        }
        const CAMERA_ROTATION = {
            x: 0, y: 90, z: 0
        }
        this.camera = MRE.Actor.CreateFromLibrary(this.context, {
            resourceId: CAMERA_RESOURCE_ID,
            actor: {
                transform: {
                    local: {
                        position: CAMERA_POSITION,
                        rotation: MRE.Quaternion.FromEulerAngles(
                            CAMERA_ROTATION.x * MRE.DegreesToRadians,
                            CAMERA_ROTATION.y * MRE.DegreesToRadians,
                            CAMERA_ROTATION.z * MRE.DegreesToRadians),
                        scale: CAMERA_SCALE
                    }
                }
            }
        });
        this.camera.appearance.enabled = false;
        this.camera.attach(user, 'spine-middle');
    }

    private enableMirror(){
        this.mirror.appearance.enabled = true;
    }

    private disableMirror(){
        this.mirror.appearance.enabled = false;
    }

    ////////////////
    //// menus
    private createMainMenu(){
        const MAIN_MENU_ITEMS = ['Inventory', 'Shop', 'Map', 'Settings'];
        const MAIN_MENU_CELL_WIDTH = 0.3;
        const MAIN_MENU_CELL_HEIGHT = 0.1;
        const MAIN_MENU_CELL_DEPTH = 0.005;
        const MAIN_MENU_CELL_MARGIN = 0.01;
        const MAIN_MENU_CELL_SCALE = 1;

        // mainmenu button
        let mainMenuMeshId = this.assets.createBoxMesh('main_menu_btn_mesh', MAIN_MENU_CELL_WIDTH, MAIN_MENU_CELL_HEIGHT, MAIN_MENU_CELL_DEPTH).id;
        let mainMenuDefaultMaterialId = this.assets.createMaterial('main_menu_default_btn_material', { color: MRE.Color3.LightGray() }).id;
        let mainMenuHighlightMeshId = this.assets.createBoxMesh('main_menu_highlight_mesh', MAIN_MENU_CELL_WIDTH+MAIN_MENU_CELL_MARGIN, MAIN_MENU_CELL_HEIGHT+MAIN_MENU_CELL_MARGIN, MAIN_MENU_CELL_DEPTH/2).id;
        let mainMenuHighlightMaterialId = this.assets.createMaterial('main_menu_highlight_btn_material', { color: MRE.Color3.Red() }).id;

        let data = MAIN_MENU_ITEMS.map(t => [{
            text: t
        }]);
        this.mainMenu = new GridMenu(this.context, {
            // logic
            title: 'Main Menu',
            data,
            shape: {
                row: MAIN_MENU_ITEMS.length,
                col: 1
            },
            // assets
            meshId: mainMenuMeshId,
            defaultMaterialId: mainMenuDefaultMaterialId,
            highlightMeshId: mainMenuHighlightMeshId,
            highlightMaterialId: mainMenuHighlightMaterialId,
            // control
            parentId: this.root.id,
            // transform
            offset: {
                x: RADIUS,
                y: RADIUS
            },
            // dimensions
            margin: MAIN_MENU_CELL_MARGIN,
            box: {
                width: MAIN_MENU_CELL_WIDTH,
                height: MAIN_MENU_CELL_HEIGHT,
                depth: MAIN_MENU_CELL_DEPTH,
                scale: MAIN_MENU_CELL_SCALE
            },
        });

        this.mainMenu.addBehavior((coord: Vector2, name: string, user: MRE.User) => {
            if (this.currentScene != 'main_menu') { return; }

            let row = coord.x;
            switch(row){
                case MAIN_MENU_ITEMS.indexOf('Inventory'):
                    this.switchScene('inventory_menu');
                    break;
                case MAIN_MENU_ITEMS.indexOf('Shop'):
                    let w = this.shopMenu.getMenuSize().width + this.shopMenuControlStrip.getMenuSize().width;
                    this.inventoryMenu.offsetMenu({x: w + this.shopMenu.margin*2, y: 0});
                    this.infoPanel.offsetMenu({x: w + this.shopMenu.margin*2, y: 0});
                    this.switchScene('shop_menu');
                    break;
                case MAIN_MENU_ITEMS.indexOf('Settings'):
                    break;
            }
        });
    }

    private createMainMenuControlStrip(){
        const MAIN_MENU_CONTROL_ITEMS = ['Lock', 'Detach', 'Tools'];
        const MAIN_MENU_CONTROL_CELL_WIDTH = 0.095;
        const MAIN_MENU_CONTROL_CELL_HEIGHT = 0.1;
        const MAIN_MENU_CONTROL_CELL_DEPTH = 0.0005;
        const MAIN_MENU_CONTROL_CELL_MARGIN = 0.0075;
        const MAIN_MENU_CONTROL_CELL_SCALE = 1;
        const MAIN_MENU_CONTROL_CELL_TEXT_HEIGHT = 0.02;

        let mainMenuControlMeshId = this.assets.createBoxMesh('main_menu_control_btn_mesh', MAIN_MENU_CONTROL_CELL_WIDTH, MAIN_MENU_CONTROL_CELL_HEIGHT, MAIN_MENU_CONTROL_CELL_DEPTH).id;
        let mainMenuControlDefaultMaterialId = this.assets.createMaterial('main_menu_control_default_btn_material', { color: MRE.Color3.LightGray() }).id;
        let mainMenuControlHighlightMeshId = this.assets.createBoxMesh('main_menu_control_highlight_mesh', MAIN_MENU_CONTROL_CELL_WIDTH+MAIN_MENU_CONTROL_CELL_MARGIN, MAIN_MENU_CONTROL_CELL_HEIGHT+MAIN_MENU_CONTROL_CELL_MARGIN, MAIN_MENU_CONTROL_CELL_DEPTH/2).id;
        let mainMenuControlHighlightMaterialId = this.assets.createMaterial('main_menu_control_highlight_btn_material', { color: MRE.Color3.Red() }).id;

        let data = [ MAIN_MENU_CONTROL_ITEMS.map(t => ({
            text: t
        })) ];

        this.mainMenuControlStrip = new GridMenu(this.context, {
            // logic
            data,
            shape: {
                row: 1,
                col: MAIN_MENU_CONTROL_ITEMS.length
            },
            // assets
            meshId: mainMenuControlMeshId,
            defaultMaterialId: mainMenuControlDefaultMaterialId,
            highlightMeshId: mainMenuControlHighlightMeshId,
            highlightMaterialId: mainMenuControlHighlightMaterialId,
            // control
            parentId: this.root.id,
            // transform
            offset: {
                x: RADIUS,
                y: RADIUS - (MAIN_MENU_CONTROL_CELL_HEIGHT + MAIN_MENU_CONTROL_CELL_MARGIN)
            },
            // dimensions
            margin: MAIN_MENU_CONTROL_CELL_MARGIN,
            box: {
                width: MAIN_MENU_CONTROL_CELL_WIDTH,
                height: MAIN_MENU_CONTROL_CELL_HEIGHT,
                depth: MAIN_MENU_CONTROL_CELL_DEPTH,
                scale: MAIN_MENU_CONTROL_CELL_SCALE,
                textHeight: MAIN_MENU_CONTROL_CELL_TEXT_HEIGHT
            },
        });
        this.mainMenuControlStrip.addBehavior((coord: Vector2, name: string, user: MRE.User) => {
            if (this.currentScene != 'main_menu') { return; }
            let col = coord.y;
            switch(col){
                case MAIN_MENU_CONTROL_ITEMS.indexOf('Lock'):
                    this.mainMenuControlStrip.highlight(coord);
                    if(this.mainMenuControlStrip.highlighted){
                        this.lockBall();
                    }else{
                        this.unlockBall();
                    }
                    break;
                case MAIN_MENU_CONTROL_ITEMS.indexOf('Detach'):
                    this.unEquipBall();
                    break;
                case MAIN_MENU_CONTROL_ITEMS.indexOf('Tools'):
                    this.switchScene('tools_menu');
                    break;
            }
        });
    }

    private createInventoryMenu(){
        const INVENTORY_DIMENSIONS = new Vector2(4, 3);
        const CELL_WIDTH = 0.1;
        const CELL_HEIGHT = 0.1;
        const CELL_DEPTH = 0.005;
        const CELL_MARGIN = 0.005;
        const CELL_SCALE = 1;

        let meshId = this.assets.createBoxMesh('btn_mesh', CELL_WIDTH, CELL_HEIGHT, CELL_DEPTH).id;
        let defaultMaterialId = this.assets.createMaterial('default_btn_material', { color: MRE.Color3.LightGray() }).id;
        let highlightMeshId = this.assets.createBoxMesh('highlight_mesh', CELL_WIDTH+CELL_MARGIN, CELL_HEIGHT+CELL_MARGIN, CELL_DEPTH/2).id;
        let highlightMaterialId = this.assets.createMaterial('highlight_btn_material', { color: MRE.Color3.Red() }).id;
        let planeMeshId = this.assets.createPlaneMesh('plane_mesh', CELL_WIDTH, CELL_HEIGHT).id;

        this.inventoryMenu = new GridMenu(this.context, {
            // logic
            name: 'inventory',
            title: 'Inventory',
            shape: {
                row: INVENTORY_DIMENSIONS.x,
                col: INVENTORY_DIMENSIONS.y
            },
            // asset
            meshId: meshId,
            defaultMaterialId: defaultMaterialId,
            highlightMeshId: highlightMeshId,
            highlightMaterialId: highlightMaterialId,
            planeMeshId: planeMeshId,
            defaultPlaneMaterial: this.defaultPlaneMaterial,
            // control
            parentId: this.root.id,
            // transform
            offset:{
                x: RADIUS,
                y: RADIUS
            },
            // dimensions
            margin: CELL_MARGIN,
            box: {
                width: CELL_WIDTH,
                height: CELL_HEIGHT,
                depth: CELL_DEPTH,
                scale: CELL_SCALE,
                textColor: MRE.Color3.White(),
                textHeight: 0.01,
                textAnchor: MRE.TextAnchorLocation.TopRight
            },
            highlight: {
                depth: CELL_DEPTH/2
            },
            plane: {
                width: CELL_WIDTH,
                height: CELL_HEIGHT
            },
        });
        this.inventoryMenu.offsetLabels({x: CELL_WIDTH/2, y: CELL_HEIGHT/2});
        this.inventoryMenu.addBehavior((coord: Vector2, name: string, user: MRE.User) => {
            if (this.currentScene != 'inventory_menu' && this.currentScene != 'shop_menu') { return; }
            this.inventoryMenu.highlight(coord);
            let index = this.inventoryMenu.getHighlightedIndex(this.inventoryMenu.coord);
            this.updateInventoryItemDescription(index);
        });
}

    private createInventoryMenuControlStrip(){
        const INVENTORY_CONTROL_ITEMS = ['Prev', 'Next', 'Equip', 'Remove', 'Back'];
        const CONTROL_CELL_WIDTH = 0.066
        const CONTROL_CELL_HEIGHT = 0.05;
        const CONTROL_CELL_DEPTH = 0.005;
        const CONTROL_CELL_MARGIN = 0.005;
        const CONTROL_CELL_SCALE = 1;
        const CONTROL_CELL_TEXT_HEIGHT = 0.015;

        let controlMeshId = this.assets.createBoxMesh('control_btn_mesh', CONTROL_CELL_WIDTH, CONTROL_CELL_HEIGHT, CONTROL_CELL_DEPTH).id;
        let controlDefaultMaterialId = this.assets.createMaterial('control_default_btn_material', { color: MRE.Color3.LightGray() }).id;
        let controlHighlightMeshId = this.assets.createBoxMesh('control_highlight_mesh', CONTROL_CELL_WIDTH+CONTROL_CELL_MARGIN, CONTROL_CELL_HEIGHT+CONTROL_CELL_MARGIN, CONTROL_CELL_DEPTH/2).id;
        let controlHighlightMaterialId = this.assets.createMaterial('control_highlight_btn_material', { color: MRE.Color3.Red() }).id;

        let data = INVENTORY_CONTROL_ITEMS.map(t => [{
            text: t
        }]);
        let size = this.inventoryMenu.getMenuSize();
        this.inventoryControlStrip = new GridMenu(this.context, {
            // logic
            data,
            shape: {
                row: INVENTORY_CONTROL_ITEMS.length,
                col: 1
            },
            // asset
            meshId: controlMeshId,
            defaultMaterialId: controlDefaultMaterialId,
            highlightMeshId: controlHighlightMeshId,
            highlightMaterialId: controlHighlightMaterialId,
            // control
            parentId: this.root.id,
            // transform
            offset: {
                x: RADIUS + size.width + CONTROL_CELL_MARGIN,
                y: RADIUS
            },
            // dimensions
            box: {
                width: CONTROL_CELL_WIDTH,
                height: CONTROL_CELL_HEIGHT,
                depth: CONTROL_CELL_DEPTH,
                scale: CONTROL_CELL_SCALE,
                textHeight: CONTROL_CELL_TEXT_HEIGHT
            },
            plane: {
                width: CONTROL_CELL_WIDTH,
                height: CONTROL_CELL_HEIGHT
            },
            margin: CONTROL_CELL_MARGIN,
        });
        this.inventoryControlStrip.addBehavior((coord: Vector2, name: string, user: MRE.User) => {
            if (this.currentScene != 'inventory_menu') { return; }

            let row = coord.x;
            switch(row){
                case INVENTORY_CONTROL_ITEMS.indexOf('Next'):
                    this.inventoryMenu.incrementPageNum(this.userItems.length);
                    this.updateMenuPage( this.inventoryMenu, this.getInventoryPageData() );
                    break;
                case INVENTORY_CONTROL_ITEMS.indexOf('Prev'):
                    this.inventoryMenu.decrementPageNum();
                    this.updateMenuPage( this.inventoryMenu, this.getInventoryPageData() );
                    break;
                case INVENTORY_CONTROL_ITEMS.indexOf('Equip'):
                    if (this.inventoryMenu.highlighted){
                        let index = this.inventoryMenu.getHighlightedIndex(this.inventoryMenu.coord);
                        this.equipItem(index, user);
                        this.updateMenuPage( this.inventoryMenu, this.getInventoryPageData(), (d: ItemDescriptor) => d.count.toString() );
                        this.updateMenuPage( this.equipmentMenu, this.userEquipments, this.getItemDescription );
                    }
                    break;
                case INVENTORY_CONTROL_ITEMS.indexOf('Remove'):
                    if (this.inventoryMenu.highlighted){
                        let index = this.equipmentMenu.getHighlightedIndex(this.equipmentMenu.coord);
                        this.removeItem(index);
                        this.updateMenuPage( this.inventoryMenu, this.getInventoryPageData(), (d: ItemDescriptor) => d.count.toString() );
                        this.updateMenuPage( this.equipmentMenu, this.userEquipments, this.getItemDescription );
                    }
                    break;
                case INVENTORY_CONTROL_ITEMS.indexOf('Back'):
                    this.switchScene('main_menu');
                    break;
            }
        });
    }

    private createInfoPanel(){
        const INFO_PANEL_PLACEHOLDER = 'Click on item for details';
        const INFO_CELL_HEIGHT = 0.1;
        const INFO_CELL_DEPTH = 0.005;
        const INFO_CELL_MARGIN = 0.005;
        const INFO_CELL_SCALE = 1;
        const INFO_CELL_TEXT_HEIGHT = 0.02;

        let data = [[{text: INFO_PANEL_PLACEHOLDER}]];
        // inventory info
        let INFO_CELL_WIDTH = this.inventoryMenu.getMenuSize().width;
        let infoPanelMeshId = this.assets.createBoxMesh('info_panel_mesh', INFO_CELL_WIDTH, INFO_CELL_HEIGHT, INFO_CELL_DEPTH).id;
        let infoPanelMaterialId = this.assets.createMaterial('info_panel_material', { color: MRE.Color3.LightGray() }).id;;

        this.infoPanel = new GridMenu(this.context, {
            // logic
            data,
            shape: {
                row: 1,
                col: 1
            },
            // assets
            meshId: infoPanelMeshId,
            defaultMaterialId: infoPanelMaterialId,
            // control
            parentId: this.root.id,
            // transform
            offset: {
                x: RADIUS,
                y: RADIUS - (INFO_CELL_HEIGHT + INFO_CELL_MARGIN)
            },
            // dimensions
            box: {
                width: INFO_CELL_WIDTH,
                height: INFO_CELL_HEIGHT,
                depth: INFO_CELL_DEPTH,
                scale: INFO_CELL_SCALE,
                textHeight: INFO_CELL_TEXT_HEIGHT
            },
            margin: INFO_CELL_MARGIN,
        });
        this.infoPanel.addBehavior((coord: Vector2, name: string, user: MRE.User)=>{});
    }

    private createEquipmentMenu(){
        const EQUIPMENT_ITEMS = ['Helmet', 'Armor', 'Weapon', 'Ring'];
        const EQUIPMENT_CELL_WIDTH = 0.3;
        const EQUIPMENT_CELL_HEIGHT = 0.1;
        const EQUIPMENT_CELL_DEPTH = 0.005;
        const EQUIPMENT_CELL_MARGIN = 0.005;
        const EQUIPMENT_CELL_SCALE = 1;
        const EQUIPMENT_CELL_TEXT_HEIGHT = 0.02;

        const EQUIPMENT_PLANE_WIDTH = 0.1;
        const EQUIPMENT_PLANE_HEIGHT = 0.1;

        let equipmentMenuMeshId = this.assets.createBoxMesh('equipment_menu_btn_mesh', EQUIPMENT_CELL_WIDTH, EQUIPMENT_CELL_HEIGHT, EQUIPMENT_CELL_DEPTH).id;
        let equipmentMenuMaterialId = this.assets.createMaterial('equipment_menu_default_btn_material', { color: MRE.Color3.LightGray() }).id;
        let equipmentMenuHighlightMeshId = this.assets.createBoxMesh('equipment_menu_highlight_mesh', EQUIPMENT_CELL_WIDTH+EQUIPMENT_CELL_MARGIN, EQUIPMENT_CELL_HEIGHT+EQUIPMENT_CELL_MARGIN, EQUIPMENT_CELL_DEPTH/2).id;
        let equipmentMenuHighlightMaterialId = this.assets.createMaterial('equipment_menu_highlight_btn_material', { color: MRE.Color3.Red() }).id;
        let equipmentMenuPlaneMeshId = this.assets.createPlaneMesh('equipment_menu_plane_mesh', EQUIPMENT_PLANE_WIDTH, EQUIPMENT_PLANE_HEIGHT).id;

        this.equipmentMenu = new GridMenu(this.context, {
            // logic
            title: 'Equipment',
            shape: {
                row: EQUIPMENT_ITEMS.length,
                col: 1
            },
            // assets
            meshId: equipmentMenuMeshId,
            defaultMaterialId: equipmentMenuMaterialId,
            highlightMeshId: equipmentMenuHighlightMeshId,
            highlightMaterialId: equipmentMenuHighlightMaterialId,
            planeMeshId: equipmentMenuPlaneMeshId,
            defaultPlaneMaterial: this.defaultPlaneMaterial,
            // control
            parentId: this.root.id,
            // transform
            offset:{
                x: RADIUS + this.inventoryMenu.getMenuSize().width + this.inventoryControlStrip.margin + this.inventoryControlStrip.getMenuSize().width + EQUIPMENT_CELL_MARGIN,
                y: RADIUS
            },
            // dimensions
            box: {
                width: EQUIPMENT_CELL_WIDTH,
                height: EQUIPMENT_CELL_HEIGHT,
                depth: EQUIPMENT_CELL_DEPTH,
                scale: EQUIPMENT_CELL_SCALE,
                textHeight: EQUIPMENT_CELL_TEXT_HEIGHT
            },
            highlight: {
                depth: EQUIPMENT_CELL_DEPTH/2,
            },
            plane: {
                width: EQUIPMENT_PLANE_WIDTH,
                height: EQUIPMENT_PLANE_HEIGHT
            },
            margin: EQUIPMENT_CELL_MARGIN,
        });
        this.equipmentMenu.offsetMenu({
            x: 0,
            y: (this.inventoryMenu.getMenuSize().height - this.equipmentMenu.getMenuSize().height)
            // asssuming inventory menu is taller
        });
        this.equipmentMenu.planesAlignLeft();
        this.equipmentMenu.labelsRightToPlane();

        this.equipmentMenu.addBehavior((coord: Vector2, name: string, user: MRE.User) => {
            if (this.currentScene != 'inventory_menu') { return; }
            this.equipmentMenu.highlight(coord);
        });
    }

    private createUserStatsPanel(){
        const STATS_CELL_WIDTH = this.equipmentMenu.getMenuSize().width;
        const STATS_CELL_HEIGHT = 0.1;
        const STATS_CELL_DEPTH = 0.005;
        const STATS_CELL_MARGIN = 0.005;
        const STATS_CELL_SCALE = 1;
        const STATS_CELL_TEXT_HEIGHT = 0.02;

        let userStatsMeshId = this.assets.createBoxMesh('user_stats_btn_mesh', STATS_CELL_WIDTH, STATS_CELL_HEIGHT, STATS_CELL_DEPTH).id;
        let userStatsMaterialId = this.assets.createMaterial('user_stats_material', { color: MRE.Color3.LightGray() }).id;;

        let data = [[{text: OWNER_NAME}]];
        // user stats
        this.userStatsPanel = new GridMenu(this.context, {
            // logic
            shape: {
                row: 1,
                col: 1
            },
            data,
            // assets
            meshId: userStatsMeshId,
            defaultMaterialId: userStatsMaterialId,
            // control
            parentId: this.root.id,
            // transform
            offset: {
                x: RADIUS + this.inventoryMenu.getMenuSize().width + this.inventoryControlStrip.margin + this.inventoryControlStrip.getMenuSize().width + STATS_CELL_MARGIN,
                y: RADIUS - (STATS_CELL_HEIGHT + STATS_CELL_MARGIN)
            },
            // dimensions
            box: {
                width: STATS_CELL_WIDTH,
                height: STATS_CELL_HEIGHT,
                depth: STATS_CELL_DEPTH,
                scale: STATS_CELL_SCALE,
                textHeight: STATS_CELL_TEXT_HEIGHT
            },
            margin: STATS_CELL_MARGIN,
        });

        this.userStatsPanel.addBehavior((coord: Vector2, name: string, user: MRE.User) => {});
    }


    private createShopMenu(){
        const SHOP_DIMENSIONS = new Vector2(3,4);
        const SHOP_CELL_WIDTH = 0.1;
        const SHOP_CELL_HEIGHT = 0.1;
        const SHOP_CELL_DEPTH = 0.005;
        const SHOP_CELL_MARGIN = 0.005;
        const SHOP_CELL_SCALE = 1;
        const SHOP_PLANE_WIDTH = 0.1;
        const SHOP_PLANE_HEIGHT = 0.1;

        let shopMenuMeshId = this.assets.createBoxMesh('shop_menu_btn_mesh', SHOP_CELL_WIDTH, SHOP_CELL_HEIGHT, SHOP_CELL_DEPTH).id;
        let shopMenuDefaultMaterialId = this.assets.createMaterial('shop_menu_default_btn_material', { color: MRE.Color3.LightGray() }).id;
        let shopMenuHighlightMeshId = this.assets.createBoxMesh('shop_menu_highlight_mesh', SHOP_CELL_WIDTH+SHOP_CELL_MARGIN, SHOP_CELL_HEIGHT+SHOP_CELL_MARGIN, SHOP_CELL_DEPTH/2).id;
        let shopMenuHighlightMaterialId = this.assets.createMaterial('shop_menu_highlight_btn_material', { color: MRE.Color3.Red() }).id;
        let shopMenuPlaneMeshId = this.assets.createPlaneMesh('shop_menu_plane_mesh', SHOP_PLANE_WIDTH, SHOP_PLANE_HEIGHT).id;
        
        this.shopMenu = new GridMenu(this.context, {
            // logic
            name: 'shop',
            title: 'Shop',
            shape: {
                row: SHOP_DIMENSIONS.x,
                col: SHOP_DIMENSIONS.y
            },
            // assets
            meshId: shopMenuMeshId,
            defaultMaterialId: shopMenuDefaultMaterialId,
            highlightMeshId: shopMenuHighlightMeshId,
            highlightMaterialId: shopMenuHighlightMaterialId,
            planeMeshId: shopMenuPlaneMeshId,
            defaultPlaneMaterial: this.defaultPlaneMaterial,
            // control
            parentId: this.root.id,
            // transform
            offset:{
                x: RADIUS,
                y: RADIUS
            },
            // dimensions
            box: {
                width: SHOP_CELL_WIDTH,
                height: SHOP_CELL_HEIGHT,
                depth: SHOP_CELL_DEPTH,
                scale: SHOP_CELL_SCALE,
                textColor: MRE.Color3.White(),
                textHeight: 0.01,
                textAnchor: MRE.TextAnchorLocation.TopRight
            },
            highlight: {
                depth: SHOP_CELL_DEPTH/2,
            },
            plane: {
                width: SHOP_CELL_WIDTH,
                height: SHOP_CELL_HEIGHT
            },
            margin: SHOP_CELL_MARGIN,
        });
        this.shopMenu.offsetLabels({x: SHOP_CELL_WIDTH/2, y: SHOP_CELL_HEIGHT/2});
        this.shopMenu.addBehavior((coord: Vector2, name: string, user: MRE.User) => {
            if (this.currentScene != 'shop_menu') { return; }
            this.shopMenu.highlight(coord);
            let index = this.shopMenu.getHighlightedIndex(this.shopMenu.coord);
            this.updateShopItemDescription(index);
        });
    }

    private createShopMenuInfoPanel(){
        const SHOP_INFO_PANEL_PLACEHOLDER = 'Click on item for details';
        const SHOP_INFO_CELL_HEIGHT = 0.1;
        const SHOP_INFO_CELL_DEPTH = 0.005;
        const SHOP_INFO_CELL_MARGIN = 0.005;
        const SHOP_INFO_CELL_SCALE = 1;
        const SHOP_INFO_CELL_TEXT_HEIGHT = 0.02;

        let data = [[{text: SHOP_INFO_PANEL_PLACEHOLDER}]];

        let shopMenuInfoPanelMaterialId = this.assets.createMaterial('shop_menu_info_panel_material', { color: MRE.Color3.LightGray() }).id;
        // inventory info
        let SHOP_INFO_CELL_WIDTH = this.shopMenu.getMenuSize().width;
        let shopMenuInfoPanelMeshId = this.assets.createBoxMesh('shop_menu_info_panel_mesh', SHOP_INFO_CELL_WIDTH, SHOP_INFO_CELL_HEIGHT, SHOP_INFO_CELL_DEPTH).id;
        this.shopMenuInfoPanel = new GridMenu(this.context, {
            // logic
            data,
            shape: {
                row: 1,
                col: 1
            },
            // assets
            meshId: shopMenuInfoPanelMeshId,
            defaultMaterialId: shopMenuInfoPanelMaterialId,
            // control
            parentId: this.root.id,
            // transform
            offset: {
                x: RADIUS,
                y: RADIUS - (SHOP_INFO_CELL_HEIGHT + SHOP_INFO_CELL_MARGIN)
            },
            // dimensions
            box: {
                width: SHOP_INFO_CELL_WIDTH,
                height: SHOP_INFO_CELL_HEIGHT,
                depth: SHOP_INFO_CELL_DEPTH,
                scale: SHOP_INFO_CELL_SCALE,
                textHeight: SHOP_INFO_CELL_TEXT_HEIGHT
            },
            margin: SHOP_INFO_CELL_MARGIN,
        });
        this.shopMenuInfoPanel.addBehavior((coord: Vector2, name: string, user: MRE.User) => {
            if (this.currentScene != 'shop_menu') { return; }
        });
    }

    private createShopMenuControlStrip(){
        const SHOP_CONTROL_ITEMS = ['Prev', 'Next', 'Buy', 'Back'];
        const SHOP_CONTROL_CELL_WIDTH = 0.066
        const SHOP_CONTROL_CELL_HEIGHT = 0.05;
        const SHOP_CONTROL_CELL_DEPTH = 0.005;
        const SHOP_CONTROL_CELL_MARGIN = 0.005;
        const SHOP_CONTROL_CELL_SCALE = 1;
        const SHOP_CONTROL_CELL_TEXT_HEIGHT = 0.02;

        let data = SHOP_CONTROL_ITEMS.map(t => [{
            text: t
        }]);

        let shopMenuControlMeshId = this.assets.createBoxMesh('shop_menu_control_btn_mesh', SHOP_CONTROL_CELL_WIDTH, SHOP_CONTROL_CELL_HEIGHT, SHOP_CONTROL_CELL_DEPTH).id;
        let shopMenuControlDefaultMaterialId = this.assets.createMaterial('shop_menu_control_default_btn_material', { color: MRE.Color3.LightGray() }).id;
        let shopMenuControlHighlightMeshId = this.assets.createBoxMesh('shop_menu_control_highlight_mesh', SHOP_CONTROL_CELL_WIDTH+SHOP_CONTROL_CELL_MARGIN, SHOP_CONTROL_CELL_HEIGHT+SHOP_CONTROL_CELL_MARGIN, SHOP_CONTROL_CELL_DEPTH/2).id;
        let shopMenuControlHighlightMaterialId = this.assets.createMaterial('shop_menu_control_highlight_btn_material', { color: MRE.Color3.Red() }).id;

        let size = this.shopMenu.getMenuSize();
        this.shopMenuControlStrip = new GridMenu(this.context, {
            // logic
            data,
            shape: {
                row: SHOP_CONTROL_ITEMS.length,
                col: 1
            },
            // assets
            meshId: shopMenuControlMeshId,
            defaultMaterialId: shopMenuControlDefaultMaterialId,
            highlightMeshId: shopMenuControlHighlightMeshId,
            highlightMaterialId: shopMenuControlHighlightMaterialId,
            // control
            parentId: this.root.id,
            // transform
            offset: {
                x: RADIUS + size.width + SHOP_CONTROL_CELL_MARGIN,
                y: RADIUS
            },
            // dimensions
            box: {
                width: SHOP_CONTROL_CELL_WIDTH,
                height: SHOP_CONTROL_CELL_HEIGHT,
                depth: SHOP_CONTROL_CELL_DEPTH,
                scale: SHOP_CONTROL_CELL_SCALE,
                textHeight: SHOP_CONTROL_CELL_TEXT_HEIGHT
            },
            margin: SHOP_CONTROL_CELL_MARGIN,
        });
        this.shopMenuControlStrip.addBehavior((coord: Vector2, name: string, user: MRE.User) => {
            if (this.currentScene != 'shop_menu') { return; }
            let row = coord.x;
            switch(row){
                case SHOP_CONTROL_ITEMS.indexOf('Prev'):
                    this.shopMenu.decrementPageNum();
                    this.updateMenuPage( this.shopMenu, this.getShopPageData() );
                    break;
                case SHOP_CONTROL_ITEMS.indexOf('Next'):
                    this.shopMenu.incrementPageNum(this.itemDatabase.length);
                    this.updateMenuPage( this.shopMenu, this.getShopPageData() );
                    break;
                case SHOP_CONTROL_ITEMS.indexOf('Buy'):
                    if (this.shopMenu.highlighted){
                        let index = this.shopMenu.getHighlightedIndex(this.shopMenu.coord);
                        this.buyItem(index);
                        this.updateMenuPage( this.inventoryMenu, this.getInventoryPageData(), (d: ItemDescriptor) => d.count.toString() );
                    }
                    break;
                case SHOP_CONTROL_ITEMS.indexOf('Back'):
                    let w = this.shopMenu.getMenuSize().width + this.shopMenuControlStrip.getMenuSize().width;
                    this.inventoryMenu.offsetMenu({x: -(w + SHOP_CONTROL_CELL_MARGIN*2), y: 0});
                    this.infoPanel.offsetMenu({x: -(w + SHOP_CONTROL_CELL_MARGIN*2), y: 0});
                    this.switchScene('main_menu');
                    break;
            }
        });
    }

    private createShopInventoryControlStrip(){
        const SHOP_INVENTORY_CONTROL_ITEMS = ['Prev', 'Next', 'Sell'];
        const SHOP_INVENTORY_CONTROL_CELL_WIDTH = 0.066
        const SHOP_INVENTORY_CONTROL_CELL_HEIGHT = 0.05;
        const SHOP_INVENTORY_CONTROL_CELL_DEPTH = 0.005;
        const SHOP_INVENTORY_CONTROL_CELL_MARGIN = 0.005;
        const SHOP_INVENTORY_CONTROL_CELL_SCALE = 1;
        const SHOP_INVENTORY_CONTROL_CELL_TEXT_HEIGHT = 0.02;

        let data = SHOP_INVENTORY_CONTROL_ITEMS.map(t => [{
            text: t
        }]);

        let shopInventoryControlMeshId = this.assets.createBoxMesh('shop_inventory_control_btn_mesh', SHOP_INVENTORY_CONTROL_CELL_WIDTH, SHOP_INVENTORY_CONTROL_CELL_HEIGHT, SHOP_INVENTORY_CONTROL_CELL_DEPTH).id;
        let shopInventoryControlDefaultMaterialId = this.assets.createMaterial('shop_inventory_control_default_btn_material', { color: MRE.Color3.LightGray() }).id;
        let shopInventoryControlHighlightMeshId = this.assets.createBoxMesh('shop_inventory_control_highlight_mesh', SHOP_INVENTORY_CONTROL_CELL_WIDTH+SHOP_INVENTORY_CONTROL_CELL_MARGIN, SHOP_INVENTORY_CONTROL_CELL_HEIGHT+SHOP_INVENTORY_CONTROL_CELL_MARGIN, SHOP_INVENTORY_CONTROL_CELL_DEPTH/2).id;
        let shopInventoryControlHighlightMaterialId = this.assets.createMaterial('shop_inventory_control_highlight_btn_material', { color: MRE.Color3.Red() }).id;

        this.shopInventoryControlStrip = new GridMenu(this.context, {
            // logic
            data,
            // assets
            meshId: shopInventoryControlMeshId,
            defaultMaterialId: shopInventoryControlDefaultMaterialId,
            highlightMeshId: shopInventoryControlHighlightMeshId,
            highlightMaterialId: shopInventoryControlHighlightMaterialId,
            // control
            parentId: this.root.id,
            // transform
            offset: {
                x: RADIUS 
                    + this.shopMenu.getMenuSize().width 
                    + this.shopMenu.margin 
                    + this.shopMenuControlStrip.getMenuSize().width 
                    + this.inventoryMenu.margin 
                    + this.inventoryMenu.getMenuSize().width 
                    + SHOP_INVENTORY_CONTROL_CELL_MARGIN,
                y: RADIUS
            },
            // dimensions
            shape: {
                row: SHOP_INVENTORY_CONTROL_ITEMS.length,
                col: 1
            },
            box: {
                width: SHOP_INVENTORY_CONTROL_CELL_WIDTH,
                height: SHOP_INVENTORY_CONTROL_CELL_HEIGHT,
                depth: SHOP_INVENTORY_CONTROL_CELL_DEPTH,
                scale: SHOP_INVENTORY_CONTROL_CELL_SCALE,
                textHeight: SHOP_INVENTORY_CONTROL_CELL_TEXT_HEIGHT
            },
            margin: SHOP_INVENTORY_CONTROL_CELL_MARGIN,
        });

        this.shopInventoryControlStrip.addBehavior((coord: Vector2, name: string, user: MRE.User) => {
            if (this.currentScene != 'shop_menu') { return; }
            let row = coord.x;
            switch(row){
                case SHOP_INVENTORY_CONTROL_ITEMS.indexOf('Prev'):
                    this.inventoryMenu.decrementPageNum();
                    this.updateMenuPage( this.inventoryMenu, this.getInventoryPageData() );
                    break;
                case SHOP_INVENTORY_CONTROL_ITEMS.indexOf('Next'):
                    this.inventoryMenu.incrementPageNum(this.userItems.length);
                    this.updateMenuPage( this.inventoryMenu, this.getInventoryPageData() );
                    break;
                case SHOP_INVENTORY_CONTROL_ITEMS.indexOf('Sell'):
                    if (this.shopMenu.highlighted){
                        let index = this.inventoryMenu.getHighlightedIndex(this.inventoryMenu.coord);
                        this.sellItem(index);
                        this.updateMenuPage( this.inventoryMenu, this.getInventoryPageData(), (d: ItemDescriptor) => d.count.toString() );
                    }
                    break;
            }
        });
    }

    private createToolsMenu(){
        const TOOLS_MENU_CELL_WIDTH = 0.4;
        const TOOLS_MENU_CELL_HEIGHT = 0.1;
        const TOOLS_MENU_CELL_DEPTH = 0.005;
        const TOOLS_MENU_CELL_MARGIN = 0.005;
        const TOOLS_MENU_CELL_SCALE = 1;

        const TOOLS_MENU_ITEMS = ['Soundboard', 'Bad Dad Jokes', 'Text To Speech', 'Mirror', 'Back'];

        let data = TOOLS_MENU_ITEMS.map(t => [{
            text: t
        }]);

        let toolsMenuMeshId = this.assets.createBoxMesh('tools_menu_btn_mesh', TOOLS_MENU_CELL_WIDTH, TOOLS_MENU_CELL_HEIGHT, TOOLS_MENU_CELL_DEPTH).id;
        let toolsMenuDefaultMaterialId = this.assets.createMaterial('tools_menu_default_btn_material', { color: MRE.Color3.LightGray() }).id;
        let toolsMenuHighlightMeshId = this.assets.createBoxMesh('tools_menu_highlight_mesh', TOOLS_MENU_CELL_WIDTH+TOOLS_MENU_CELL_MARGIN, TOOLS_MENU_CELL_HEIGHT+TOOLS_MENU_CELL_MARGIN, TOOLS_MENU_CELL_DEPTH/2).id;
        let toolsMenuHighlightMaterialId = this.assets.createMaterial('tools_menu_highlight_btn_material', { color: MRE.Color3.Red() }).id;

        this.toolsMenu = new GridMenu(this.context, {
            // logic
            title: 'Tools',
            data,
            shape: {
                row: TOOLS_MENU_ITEMS.length,
                col: 1
            },
            // assets
            meshId: toolsMenuMeshId,
            defaultMaterialId: toolsMenuDefaultMaterialId,
            highlightMeshId: toolsMenuHighlightMeshId,
            highlightMaterialId: toolsMenuHighlightMaterialId,
            // control
            parentId: this.root.id,
            // transform
            offset: {
                x: RADIUS,
                y: RADIUS
            },
            // dimensions
            box: {
                width: TOOLS_MENU_CELL_WIDTH,
                height: TOOLS_MENU_CELL_HEIGHT,
                depth: TOOLS_MENU_CELL_DEPTH,
                scale: TOOLS_MENU_CELL_SCALE
            },
            margin: TOOLS_MENU_CELL_MARGIN,
        });

        this.toolsMenu.addBehavior((coord: Vector2, name: string, user: MRE.User) => {
            if (this.currentScene != 'tools_menu') return;
            let row = coord.x;
            switch(row){
                case TOOLS_MENU_ITEMS.indexOf('Soundboard'):
                    this.switchScene('soundboard_menu');
                    break;
                case TOOLS_MENU_ITEMS.indexOf('Bad Dad Jokes'):
                    this.switchScene('bdj_menu');
                    break;
                case TOOLS_MENU_ITEMS.indexOf('Text To Speech'):
                    user.prompt("Text To Speech", true).then((dialog) => {
                        if (dialog.submitted) {
                            this.textToSpeech(dialog.text);
                        }
                    });
                    break;
                case TOOLS_MENU_ITEMS.indexOf('Mirror'):
                    this.toolsMenu.highlight(coord);
                    if (this.toolsMenu.highlighted) { this.enableMirror(); }
                    else { this.disableMirror(); }
                    break;
                case TOOLS_MENU_ITEMS.indexOf('Back'):
                    this.switchScene('main_menu');
                    break;
            }
        });
    }

    private createBDJMenu(){
        const BDJ_MENU_CELL_WIDTH = 0.4;
        const BDJ_MENU_CELL_HEIGHT = 0.2;
        const BDJ_MENU_CELL_DEPTH = 0.005;
        const BDJ_MENU_CELL_MARGIN = 0.005;
        const BDJ_MENU_CELL_SCALE = 1;
        const BDJ_MENU_CELL_TEXT_HEIGHT = 0.02;

        const BDJ_PLANE_WIDTH = 0.1;
        const BDJ_PLANE_HEIGHT = 0.1;

        let BDJMenuMeshId = this.assets.createBoxMesh('bdj_menu_btn_mesh', BDJ_MENU_CELL_WIDTH, BDJ_MENU_CELL_HEIGHT, BDJ_MENU_CELL_DEPTH).id;
        let BDJMenuDefaultMaterialId = this.assets.createMaterial('bdj_menu_default_btn_material', { color: MRE.Color3.White() }).id;
        let BDJMenuPlaneMeshId = this.assets.createPlaneMesh('bdj_menu_plane_mesh', BDJ_PLANE_WIDTH, BDJ_PLANE_HEIGHT).id;
        let BDJMenuHighlightMeshId = this.assets.createBoxMesh('bdj_menu_highlight_mesh', BDJ_MENU_CELL_WIDTH+BDJ_MENU_CELL_MARGIN, BDJ_MENU_CELL_HEIGHT+BDJ_MENU_CELL_MARGIN, BDJ_MENU_CELL_DEPTH/2).id;
        let BDJMenuHighlightMaterialId = this.assets.createMaterial('bdj_menu_highlight_btn_material', { color: MRE.Color3.Red() }).id;

        let setupMaterial = this.loadMaterial('setup', `${this.baseUrl}/setup.png`);
        let punclineMaterial = this.loadMaterial('punch', `${this.baseUrl}/punch.png`);
        const BDJ_MATERIALS = [setupMaterial, punclineMaterial];

        let data = BDJ_MATERIALS.map(m => [{
            text: '',
            material: m
        }]);

        this.BDJMenu = new GridMenu(this.context, {
            // logic
            title: 'Bad Dad Jokes',
            data,
            shape: {
                row: BDJ_MATERIALS.length,
                col: 1
            },
            // assets
            meshId: BDJMenuMeshId,
            defaultMaterialId: BDJMenuDefaultMaterialId,
            planeMeshId: BDJMenuPlaneMeshId,
            defaultPlaneMaterial: this.defaultPlaneMaterial,
            highlightMeshId: BDJMenuHighlightMeshId,
            highlightMaterialId: BDJMenuHighlightMaterialId,
            // control
            parentId: this.root.id,
            // transform
            offset: {
                x: RADIUS,
                y: RADIUS
            },
            // dimensions
            box: {
                width: BDJ_MENU_CELL_WIDTH,
                height: BDJ_MENU_CELL_HEIGHT,
                depth: BDJ_MENU_CELL_DEPTH,
                scale: BDJ_MENU_CELL_SCALE,
                textHeight: BDJ_MENU_CELL_TEXT_HEIGHT
            },
            plane: {
                width: BDJ_PLANE_WIDTH,
                height: BDJ_PLANE_HEIGHT
            },
            margin: BDJ_MENU_CELL_MARGIN,
        });

        this.BDJMenu.planesAlignLeft();
        this.BDJMenu.labelsRightToPlane();

        this.BDJMenu.addBehavior((coord: Vector2, name: string, user: MRE.User) => {
            if (this.currentScene != 'bdj_menu') { return; }
            this.BDJMenu.highlight(coord);
        });
    }

    private createBDJMenuControlStrip(){
        const BDJ_CONTROL_CELL_WIDTH = 0.2;
        const BDJ_CONTROL_CELL_HEIGHT = 0.05;
        const BDJ_CONTROL_CELL_DEPTH = 0.005;
        const BDJ_CONTROL_CELL_MARGIN = 0.005;
        const BDJ_CONTROL_CELL_SCALE = 1;
        const BDJ_CONTROL_CELL_TEXT_HEIGHT = 0.02;

        const BDJ_CONTROL_ITEMS = ['Dad Joke', 'Knock Knock', 'Show Punch', 'Read', 'Back'];

        let BDJMenuControlMeshId = this.assets.createBoxMesh('bdj_menu_control_btn_mesh', BDJ_CONTROL_CELL_WIDTH, BDJ_CONTROL_CELL_HEIGHT, BDJ_CONTROL_CELL_DEPTH).id;
        let BDJMenuControlDefaultMaterialId = this.assets.createMaterial('bdj_menu_control_default_btn_material', { color: MRE.Color3.LightGray() }).id;

        let data = BDJ_CONTROL_ITEMS.map(t => [{
            text: t
        }]);

        this.BDJMenuControlStrip = new GridMenu(this.context, {
            // logic
            data,
            shape: {
                row: BDJ_CONTROL_ITEMS.length,
                col: 1
            },
            // assets
            meshId: BDJMenuControlMeshId,
            defaultMaterialId: BDJMenuControlDefaultMaterialId,
            // control
            parentId: this.root.id,
            // transform
            offset: {
                x: RADIUS + this.BDJMenu.getMenuSize().width + this.BDJMenu.margin,
                y: RADIUS
            },
            // dimensions
            box: {
                width: BDJ_CONTROL_CELL_WIDTH,
                height: BDJ_CONTROL_CELL_HEIGHT,
                depth: BDJ_CONTROL_CELL_DEPTH,
                scale: BDJ_CONTROL_CELL_SCALE,
                textHeight: BDJ_CONTROL_CELL_TEXT_HEIGHT
            },
            margin: BDJ_CONTROL_CELL_MARGIN,
        });

        this.BDJMenuControlStrip.addBehavior((coord: Vector2, name: string, user: MRE.User) => {
            if (this.currentScene != 'bdj_menu') return;
            let row = coord.x;
            switch(row){
                case BDJ_CONTROL_ITEMS.indexOf('Dad Joke'):
                    this.updateBDJ(JOKE_TYPE.GENERAL);
                    break;
                case BDJ_CONTROL_ITEMS.indexOf('Knock Knock'):
                    this.updateBDJ(JOKE_TYPE.KNOCK_KNOCK);
                    break;
                case BDJ_CONTROL_ITEMS.indexOf('Show Punch'):
                    break;
                case BDJ_CONTROL_ITEMS.indexOf('Read'):
                    if (this.BDJMenu.highlighted){
                        let r = this.BDJMenu.coord.x;
                        let text = '';
                        if (r == 0){
                            text = this.dadJoke[0].setup;
                        } else{
                            text = this.dadJoke[0].punchline;
                        }
                        this.textToSpeech(text);
                    }
                    break;
                case BDJ_CONTROL_ITEMS.indexOf('Back'):
                    this.switchScene('main_menu');
                    break;
            }
        });
    }

    private createSoundboardMenu(){
        const SOUNDBOARD_DIMENSIONS = new Vector2(6,6);
        const SOUNDBOARD_CELL_WIDTH = 0.08;
        const SOUNDBOARD_CELL_HEIGHT = 0.08;
        const SOUNDBOARD_CELL_DEPTH = 0.005;
        const SOUNDBOARD_CELL_MARGIN = 0.004;
        const SOUNDBOARD_CELL_SCALE = 1;

        let soundboardMenuMeshId = this.assets.createBoxMesh('sounboard_menu_btn_mesh', SOUNDBOARD_CELL_WIDTH, SOUNDBOARD_CELL_HEIGHT, SOUNDBOARD_CELL_DEPTH).id;
        let soundboardMenuDefaultMaterialId = this.assets.createMaterial('sounboard_menu_default_btn_material', { color: MRE.Color3.DarkGray() }).id;
        let soundboardMenuHighlightMeshId = this.assets.createBoxMesh('sounboard_menu_highlight_mesh', SOUNDBOARD_CELL_WIDTH+SOUNDBOARD_CELL_MARGIN, SOUNDBOARD_CELL_HEIGHT+SOUNDBOARD_CELL_MARGIN, SOUNDBOARD_CELL_DEPTH/2).id;
        let soundboardMenuHighlightMaterialId = this.assets.createMaterial('sounboard_menu_highlight_btn_material', { color: MRE.Color3.Red() }).id;
        
        this.soundboardMenu = new GridMenu(this.context, {
            // logic
            name: 'soundboard',
            title: 'Soundboard',
            shape: {
                row: SOUNDBOARD_DIMENSIONS.x,
                col: SOUNDBOARD_DIMENSIONS.y
            },
            // assets
            meshId: soundboardMenuMeshId,
            defaultMaterialId: soundboardMenuDefaultMaterialId,
            highlightMeshId: soundboardMenuHighlightMeshId,
            highlightMaterialId: soundboardMenuHighlightMaterialId,
            // control
            parentId: this.root.id,
            // transform
            offset:{
                x: RADIUS,
                y: RADIUS
            },
            // dimensions
            box: {
                width: SOUNDBOARD_CELL_WIDTH,
                height: SOUNDBOARD_CELL_HEIGHT,
                depth: SOUNDBOARD_CELL_DEPTH,
                scale: SOUNDBOARD_CELL_SCALE,
                textColor: MRE.Color3.White(),
                textHeight: 0.01,
                textAnchor: MRE.TextAnchorLocation.MiddleCenter
            },
            highlight: {
                depth: SOUNDBOARD_CELL_DEPTH/2,
            },
            margin: SOUNDBOARD_CELL_MARGIN,
        });
        this.soundboardMenu.addBehavior((coord: Vector2, name: string, user: MRE.User) => {
            if (this.currentScene != 'soundboard_menu') { return; }
            this.soundboardMenu.highlight(coord);
            let index = this.soundboardMenu.getHighlightedIndex(this.shopMenu.coord);
        });
    }

    private createSoundboardMenuControlStrip(){
        const SOUNDBOARD_CONTROL_CELL_WIDTH = 0.1;
        const SOUNDBOARD_CONTROL_CELL_HEIGHT = 0.05;
        const SOUNDBOARD_CONTROL_CELL_DEPTH = 0.005;
        const SOUNDBOARD_CONTROL_CELL_MARGIN = 0.005;
        const SOUNDBOARD_CONTROL_CELL_SCALE = 1;
        const SOUNDBOARD_CONTROL_CELL_TEXT_HEIGHT = 0.02;

        const SOUNDBOARD_CONTROL_ITEMS = ['', 'Search', 'Goto', 'Prev', 'Next', 'Play', 'Stop', 'Back'];

        let soundboardMenuControlMeshId = this.assets.createBoxMesh('soundboard_menu_control_btn_mesh', SOUNDBOARD_CONTROL_CELL_WIDTH, SOUNDBOARD_CONTROL_CELL_HEIGHT, SOUNDBOARD_CONTROL_CELL_DEPTH).id;
        let soundboardMenuControlDefaultMaterialId = this.assets.createMaterial('soundboard_menu_control_default_btn_material', { color: MRE.Color3.LightGray() }).id;

        let data = SOUNDBOARD_CONTROL_ITEMS.map(t => [{
            text: t
        }]);

        this.soundboardMenuControlStrip = new GridMenu(this.context, {
            // logic
            data,
            shape: {
                row: SOUNDBOARD_CONTROL_ITEMS.length,
                col: 1
            },
            // assets
            meshId: soundboardMenuControlMeshId,
            defaultMaterialId: soundboardMenuControlDefaultMaterialId,
            // control
            parentId: this.root.id,
            // transform
            offset: {
                x: RADIUS + this.soundboardMenu.getMenuSize().width + this.soundboardMenu.margin,
                y: RADIUS
            },
            // dimensions
            box: {
                width: SOUNDBOARD_CONTROL_CELL_WIDTH,
                height: SOUNDBOARD_CONTROL_CELL_HEIGHT,
                depth: SOUNDBOARD_CONTROL_CELL_DEPTH,
                scale: SOUNDBOARD_CONTROL_CELL_SCALE,
                textHeight: SOUNDBOARD_CONTROL_CELL_TEXT_HEIGHT
            },
            margin: SOUNDBOARD_CONTROL_CELL_MARGIN,
        });

        this.soundboardMenuControlStrip.addBehavior((coord: Vector2, name: string, user: MRE.User) => {
            if (this.currentScene != 'soundboard_menu') return;
            let row = coord.x;
            switch(row){
                case SOUNDBOARD_CONTROL_ITEMS.indexOf('Search'):
                    user.prompt("Search meme", true).then((dialog) => {
                        if (dialog.submitted) {
                            this.searchMeme(dialog.text);
                            this.soundboardMenu.resetPageNum();
                            this.updateSoundboard( this.getMemePageData() );
                        }
                    });
                    break;
                case SOUNDBOARD_CONTROL_ITEMS.indexOf('Goto'):
                    user.prompt("Goto page", true).then((dialog) => {
                        if (dialog.submitted) {
                            let p = parseInt(dialog.text);
                            if (p!==NaN){
                                this.soundboardMenu.setPageNum(p, this.memes.length);
                                this.updateSoundboard( this.getMemePageData() );
                            }
                        }
                    });
                    break;
                case SOUNDBOARD_CONTROL_ITEMS.indexOf('Prev'):
                    this.soundboardMenu.decrementPageNum();
                    this.updateSoundboard( this.getMemePageData() );
                    break;
                case SOUNDBOARD_CONTROL_ITEMS.indexOf('Next'):
                    this.soundboardMenu.incrementPageNum( this.memes.length );
                    this.updateSoundboard( this.getMemePageData() );
                    break;
                case SOUNDBOARD_CONTROL_ITEMS.indexOf('Play'):
                    if (this.soundboardMenu.highlighted){
                        let index = this.soundboardMenu.getHighlightedIndex(this.soundboardMenu.coord);
                        this.playMeme(index);
                    }
                    break;
                case SOUNDBOARD_CONTROL_ITEMS.indexOf('Stop'):
                    this.stopMemes();
                    break;
                case SOUNDBOARD_CONTROL_ITEMS.indexOf('Back'):
                    this.switchScene('main_menu');
                    break;
            }
        });
    }

    private toggleMenu(){
        console.log(this.currentScene, 'to', this.prevScene);
        if (this.currentScene == ''){
            this.root.transform.local.position = new Vector3(0, 0, 0);
            this.switchScene(this.prevScene);
        } else{
            this.prevScene = this.currentScene;
            this.root.transform.local.position = new Vector3(10, 10, 10);
            this.switchScene('');
        }
    }
}