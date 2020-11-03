import fs from 'fs';
import crypto from 'crypto';
import path from 'path';

import * as MRE from '@microsoft/mixed-reality-extension-sdk';
const text2wav = require('text2wav');

const sha256 = (x:string) => crypto.createHash('sha256').update(x, 'utf8').digest('hex');

const geotz = require('geo-tz');
const moment = require('moment-timezone');
const cloneDeep = require('clone-deep');

import {fetchJSON} from './fetchJSON';
import {GridMenu, Button, CellData} from './GUI';
import { Vector2 } from '@microsoft/mixed-reality-extension-sdk';

const API_KEY = process.env['API_KEY'];
const OWNER_NAME = process.env['OWNER_NAME'];

// CONFIGARABLES.
const JOINED_SOUND_DURATION = 4860;
const LEFT_SOUND_DURATION = 3200;
const DELAY_BETWEEN_SOUNDS = 100;

const RADIUS=0.1;

// Main Menu
const MAIN_MENU_ITEMS = ['Inventory', 'Shop', 'Map', 'Settings'];
const MAIN_MENU_CELL_WIDTH = 0.3;
const MAIN_MENU_CELL_HEIGHT = 0.1;
const MAIN_MENU_CELL_DEPTH = 0.005;
const MAIN_MENU_CELL_MARGIN = 0.01;
const MAIN_MENU_CELL_SCALE = 1;

const MAIN_MENU_CONTROL_ITEMS = ['Lock', 'Detach', 'Tools'];
const MAIN_MENU_CONTROL_CELL_WIDTH = 0.095;
const MAIN_MENU_CONTROL_CELL_HEIGHT = 0.1;
const MAIN_MENU_CONTROL_CELL_DEPTH = 0.0005;
const MAIN_MENU_CONTROL_CELL_MARGIN = 0.0075;
const MAIN_MENU_CONTROL_CELL_SCALE = 1;
const MAIN_MENU_CONTROL_CELL_TEXT_HEIGHT = 0.02;

// Inventory
const INVENTORY_DIMENSIONS = new Vector2(4, 3);
const CELL_WIDTH = 0.1;
const CELL_HEIGHT = 0.1;
const CELL_DEPTH = 0.005;
const CELL_MARGIN = 0.005;
const CELL_SCALE = 1;

const INVENTORY_CONTROL_ITEMS = ['Prev', 'Next', 'Equip', 'UnEqp', 'Back'];
const CONTROL_CELL_WIDTH = 0.066
const CONTROL_CELL_HEIGHT = 0.05;
const CONTROL_CELL_DEPTH = 0.005;
const CONTROL_CELL_MARGIN = 0.005;
const CONTROL_CELL_SCALE = 1;
const CONTROL_CELL_TEXT_HEIGHT = 0.02;

const INFO_PANEL_PLACEHOLDER = 'Click on item for details';
const INFO_CELL_HEIGHT = 0.1;
const INFO_CELL_DEPTH = 0.005;
const INFO_CELL_MARGIN = 0.005;
const INFO_CELL_SCALE = 1;
const INFO_CELL_TEXT_HEIGHT = 0.02;

const EQUIPMENT_ITEMS = ['Helmet', 'Armor', 'Weapon', 'Potion'];
const EQUIPMENT_CELL_WIDTH = 0.3;
const EQUIPMENT_CELL_HEIGHT = 0.1;
const EQUIPMENT_CELL_DEPTH = 0.005;
const EQUIPMENT_CELL_MARGIN = 0.005;
const EQUIPMENT_CELL_SCALE = 1;
const EQUIPMENT_CELL_TEXT_HEIGHT = 0.02;

const EQUIPMENT_PLANE_WIDTH = 0.1;
const EQUIPMENT_PLANE_HEIGHT = 0.1;

const STATS_CELL_WIDTH = EQUIPMENT_CELL_WIDTH;
const STATS_CELL_HEIGHT = 0.1;
const STATS_CELL_DEPTH = 0.005;
const STATS_CELL_MARGIN = 0.005;
const STATS_CELL_SCALE = 1;
const STATS_CELL_TEXT_HEIGHT = 0.02;

// Shop
const SHOP_DIMENSIONS = new Vector2(3,4);
const SHOP_CONTROL_ITEMS = ['Prev', 'Next', 'Buy', 'Back'];
const SHOP_CONTROL_CELL_WIDTH = 0.066
const SHOP_CONTROL_CELL_HEIGHT = 0.05;
const SHOP_CONTROL_CELL_DEPTH = 0.005;
const SHOP_CONTROL_CELL_MARGIN = 0.005;
const SHOP_CONTROL_CELL_SCALE = 1;
const SHOP_CONTROL_CELL_TEXT_HEIGHT = 0.02;

const SHOP_INVENTORY_CONTROL_ITEMS = ['Prev', 'Next', 'Sell'];
const SHOP_INVENTORY_CONTROL_CELL_WIDTH = 0.066
const SHOP_INVENTORY_CONTROL_CELL_HEIGHT = 0.05;
const SHOP_INVENTORY_CONTROL_CELL_DEPTH = 0.005;
const SHOP_INVENTORY_CONTROL_CELL_MARGIN = 0.005;
const SHOP_INVENTORY_CONTROL_CELL_SCALE = 1;
const SHOP_INVENTORY_CONTROL_CELL_TEXT_HEIGHT = 0.02;

const SHOP_CELL_WIDTH = 0.1;
const SHOP_CELL_HEIGHT = 0.1;
const SHOP_CELL_DEPTH = 0.005;
const SHOP_CELL_MARGIN = 0.005;
const SHOP_CELL_SCALE = 1;
const SHOP_PLANE_WIDTH = 0.1;
const SHOP_PLANE_HEIGHT = 0.1;

const SHOP_INFO_PANEL_PLACEHOLDER = 'Click on item for details';
const SHOP_INFO_CELL_HEIGHT = 0.1;
const SHOP_INFO_CELL_DEPTH = 0.005;
const SHOP_INFO_CELL_MARGIN = 0.005;
const SHOP_INFO_CELL_SCALE = 1;
const SHOP_INFO_CELL_TEXT_HEIGHT = 0.02;

// Tools
const TOOLS_MENU_CELL_WIDTH = 0.4;
const TOOLS_MENU_CELL_HEIGHT = 0.1;
const TOOLS_MENU_CELL_DEPTH = 0.005;
const TOOLS_MENU_CELL_MARGIN = 0.005;
const TOOLS_MENU_CELL_SCALE = 1;

const TOOLS_MENU_ITEMS = ['Soundboard', 'Bad Dad Jokes', 'Text To Speech', 'Mirror', 'Back'];

interface playSoundOptions{
    rolloffStartDistance?: number;
    volume?: number;
}

type ObjectDescriptor = {
    thumbnailUri: string;
    resourceId: string;
    attachPoint: string;
    scale?: {
        x: number;
        y: number;
        z: number;
    };
    rotation?: {
        x: number;
        y: number;
        z: number;
    };
    position?: {
        x: number;
        y: number;
        z: number;
    };
};

// game related data structures.
enum ItemType {
    'Helmet' = 0,
    'Armor',
    'Weapon',
    'Potion'
}

export interface ItemDescriptor {
    obj: ObjectDescriptor,
    id: number,
    name: string,
    type: ItemType,
    attack?: number,
    defense?: number,
    count?: number
    cost: number,
}

type UserStats = {
    hp: number,
    attack: number,
    defense: number,
    coins: number
}

class MainMenu extends GridMenu{
    onItemClick(coord: Vector2, name: string, user: MRE.User){
        if (this.app.scene != 'main_menu') { return; }

        let row = coord.x;
        switch(row){
            case MAIN_MENU_ITEMS.indexOf('Inventory'):
                this.app.switchScene('inventory_menu');
                break;
            case MAIN_MENU_ITEMS.indexOf('Shop'):
                let w = this.app.shop.getMenuSize().width + this.app.shopControl.getMenuSize().width;
                this.app.inventory.offsetMenu({x: w + SHOP_CELL_MARGIN*2, y: 0});
                this.app.info.offsetMenu({x: w + SHOP_CELL_MARGIN*2, y: 0});
                this.app.switchScene('shop_menu');
                break;
            case MAIN_MENU_ITEMS.indexOf('Settings'):
                break;
        }
    }
}

class MainMenuControlStrip extends GridMenu{
    onItemClick(coord: Vector2, name: string, user: MRE.User){
        if (this.app.scene != 'main_menu') { return; }
        let col = coord.y;
        switch(col){
            case MAIN_MENU_CONTROL_ITEMS.indexOf('Lock'):
                this.highlight(coord);
                if(this.highlighted){
                    this.app.lockBall();
                }else{
                    this.app.unlockBall();
                }
                break;
            case MAIN_MENU_CONTROL_ITEMS.indexOf('Detach'):
                break;
            case MAIN_MENU_CONTROL_ITEMS.indexOf('Tools'):
                this.app.switchScene('tools_menu');
                break;
        }
    }
}

class InventoryMenu extends GridMenu{
    onItemClick(coord: Vector2, name: string, user: MRE.User){
        if (this.app.scene != 'inventory_menu' && this.app.scene != 'shop_menu') { return; }
        this.highlight(coord);
        let index = this.app.inventory.getHighlightedIndex(this.app.inventory.coord);
        this.app.updateInventoryItemDescription(index);
    }
}

class ControlMenu extends GridMenu{
    onItemClick(coord: Vector2, name: string, user: MRE.User){
        if (this.app.scene != 'inventory_menu') { return; }

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

class InfoPanel extends GridMenu{
    onItemClick(coord: Vector2, name: string, user: MRE.User){}
}

class EquipmentMenu extends GridMenu{
    onItemClick(coord: Vector2, name: string, user: MRE.User){
        if (this.app.scene != 'inventory_menu') { return; }
        this.highlight(coord);
    }
}

class ShopMenu extends GridMenu{
    onItemClick(coord: Vector2, name: string, user: MRE.User){
        if (this.app.scene != 'shop_menu') { return; }
        this.highlight(coord);
        let index = this.app.shop.getHighlightedIndex(this.app.shop.coord);
        this.app.updateShopItemDescription(index);
    }
}

class ShopMenuInfoPanel extends GridMenu{
    onItemClick(coord: Vector2, name: string, user: MRE.User){
        if (this.app.scene != 'shop_menu') { return; }
    }
}

class ShopMenuControlStrip extends GridMenu{
    onItemClick(coord: Vector2, name: string, user: MRE.User){
        if (this.app.scene != 'shop_menu') { return; }
        let row = coord.x;
        switch(row){
            case SHOP_CONTROL_ITEMS.indexOf('Prev'):
                this.app.shop.decrementPageNum();
                this.app.updateMenuPage( this.app.shop, this.app.getShopPageData() );
                break;
            case SHOP_CONTROL_ITEMS.indexOf('Next'):
                this.app.shop.incrementPageNum(this.app.itemDatabaseLength);
                this.app.updateMenuPage( this.app.shop, this.app.getShopPageData() );
                break;
            case SHOP_CONTROL_ITEMS.indexOf('Buy'):
                if (this.app.shop.highlighted){
                    let index = this.app.shop.getHighlightedIndex(this.app.shop.coord);
                    this.app.buyItem(index);
                    this.app.updateMenuPage( this.app.inventory, this.app.getInventoryPageData(), (d: ItemDescriptor) => d.count.toString() );
                }
                break;
            case SHOP_CONTROL_ITEMS.indexOf('Back'):
                let w = this.app.shop.getMenuSize().width + this.app.shopControl.getMenuSize().width;
                this.app.inventory.offsetMenu({x: -(w + SHOP_CELL_MARGIN*2), y: 0});
                this.app.info.offsetMenu({x: -(w + SHOP_CELL_MARGIN*2), y: 0});
                this.app.switchScene('main_menu');
                break;
        }
    }
}

class ShopInventoryControlStrip extends GridMenu{
    onItemClick(coord: Vector2, name: string, user: MRE.User){
        if (this.app.scene != 'shop_menu') { return; }
        let row = coord.x;
        switch(row){
            case SHOP_INVENTORY_CONTROL_ITEMS.indexOf('Prev'):
                this.app.inventory.decrementPageNum();
                this.app.updateMenuPage( this.app.inventory, this.app.getInventoryPageData() );
                break;
            case SHOP_INVENTORY_CONTROL_ITEMS.indexOf('Next'):
                this.app.inventory.incrementPageNum(this.app.userItemsLength);
                this.app.updateMenuPage( this.app.inventory, this.app.getInventoryPageData() );
                break;
            case SHOP_INVENTORY_CONTROL_ITEMS.indexOf('Sell'):
                if (this.app.shop.highlighted){
                    let index = this.app.inventory.getHighlightedIndex(this.app.inventory.coord);
                    this.app.sellItem(index);
                    this.app.updateMenuPage( this.app.inventory, this.app.getInventoryPageData(), (d: ItemDescriptor) => d.count.toString() );
                }
                break;
        }
    }
}

class ToolsMenu extends GridMenu{
    onItemClick(coord: Vector2, name: string, user: MRE.User){
        if (this.app.scene != 'tools_menu') return;
        let row = coord.x;
        switch(row){
            case TOOLS_MENU_ITEMS.indexOf('Soundboard'):
                break;
            case TOOLS_MENU_ITEMS.indexOf('Bad Dad Jokes'):
                break;
            case TOOLS_MENU_ITEMS.indexOf('Text To Speech'):
                user.prompt("Text To Speech", true).then((dialog) => {
                    if (dialog.submitted) {
                        this.app.tts(dialog.text);
                    }
                });
                break;
            case TOOLS_MENU_ITEMS.indexOf('Mirror'):
                this.highlight(coord);
                break;
            case TOOLS_MENU_ITEMS.indexOf('Back'):
                this.app.switchScene('main_menu');
                break;
        }
    }
}

class UserStatsPanel extends GridMenu{
    onItemClick(coord: Vector2, name: string, user: MRE.User){}
}

/**
 * The main class of this app. All the logic goes here.
 */
export class Inventory {

    private context: MRE.Context;
    private baseUrl: string;
    private assets: MRE.AssetContainer;

    ////////////////
    //// main menu
    private mainMenuMeshId: MRE.Guid;
    private mainMenuDefaultMaterialId: MRE.Guid;
    private mainMenuHighlightMeshId: MRE.Guid;
    private mainMenuHighlightMaterialId: MRE.Guid;

    private mainMenuControlMeshId: MRE.Guid;
    private mainMenuControlDefaultMaterialId: MRE.Guid;
    private mainMenuControlHighlightMeshId: MRE.Guid;
    private mainMenuControlHighlightMaterialId: MRE.Guid;

    // inventory menu
    private meshId: MRE.Guid;
    private defaultMaterialId: MRE.Guid;
    private highlightMeshId: MRE.Guid;
    private highlightMaterialId: MRE.Guid;
    private planeMeshId: MRE.Guid;

    private controlMeshId: MRE.Guid;
    private controlDefaultMaterialId: MRE.Guid;
    private controlHighlightMeshId: MRE.Guid;
    private controlHighlightMaterialId: MRE.Guid;

    private infoPanelMeshId: MRE.Guid;
    private infoPanelMaterialId: MRE.Guid;

    private equipmentMenuMeshId: MRE.Guid;
    private equipmentMenuMaterialId: MRE.Guid;
    private equipmentMenuHighlightMeshId: MRE.Guid;
    private equipmentMenuHighlightMaterialId: MRE.Guid;
    private equipmentMenuPlaneMeshId: MRE.Guid;
    
    private userStatsMeshId: MRE.Guid;
    private userStatsMaterialId: MRE.Guid;

    // shop menu
    private shopMenuMeshId: MRE.Guid;
    private shopMenuDefaultMaterialId: MRE.Guid;
    private shopMenuHighlightMeshId: MRE.Guid;
    private shopMenuHighlightMaterialId: MRE.Guid;
    private shopMenuPlaneMeshId: MRE.Guid;

    private shopMenuInfoPanelMeshId: MRE.Guid;
    private shopMenuInfoPanelMaterialId: MRE.Guid;

    private shopMenuControlMeshId: MRE.Guid;
    private shopMenuControlDefaultMaterialId: MRE.Guid;
    private shopMenuControlHighlightMeshId: MRE.Guid;
    private shopMenuControlHighlightMaterialId: MRE.Guid;

    private shopInventoryControlMeshId: MRE.Guid;
    private shopInventoryControlDefaultMaterialId: MRE.Guid;
    private shopInventoryControlHighlightMeshId: MRE.Guid;
    private shopInventoryControlHighlightMaterialId: MRE.Guid;

    // tools menu
    private toolsMenuMeshId: MRE.Guid;
    private toolsMenuDefaultMaterialId: MRE.Guid;
    private toolsMenuHighlightMeshId: MRE.Guid;
    private toolsMenuHighlightMaterialId: MRE.Guid;

    private joinedSound: MRE.Sound;
    private leftSound: MRE.Sound;

    private defaultPlaneMaterial: MRE.Material;


    ////////////////
    //// logic
    private ball: Button;

    // main menu
    private mainMenu: MainMenu;
    private mainMenuControlStrip: MainMenuControlStrip;

    // inventory menu
    private inventoryMenu: InventoryMenu;
    private inventoryControlStrip: ControlMenu;
    private infoPanel: InfoPanel;
    private equipmentMenu: EquipmentMenu;
    private userStatsPanel: UserStatsPanel;

    // shop menu
    private shopMenu: ShopMenu;
    private shopMenuInfoPanel: ShopMenuInfoPanel;
    private shopMenuControlStrip: ShopMenuControlStrip;
    private shopInventoryControlStrip: ShopInventoryControlStrip;

    // tools menu
    private toolsMenu: ToolsMenu;

    // states
    private scenes: Array<[string, GridMenu[]]> = [];
    private currentScene: string = '#';
    private prevScene: string = 'main_menu';

    // data
    private itemDatabase: ItemDescriptor[];
    private userItems: ItemDescriptor[];
    private itemIdToItem: Map<number, ItemDescriptor> = new Map<number, ItemDescriptor>();

    private userStats: UserStats;

    // get
    get scene() { return this.currentScene; }
    get info() { return this.infoPanel; }
    get inventory() { return this.inventoryMenu; }
    get shop() { return this.shopMenu; }
    get shopControl() { return this.shopMenuControlStrip; }
    get url() { return this.baseUrl; }
    get itemDatabaseLength() { return this.itemDatabase.length; }
    get userItemsLength() { return this.userItems.length; }
    public textures: Map<string, MRE.Texture>;
    public materials: Map<string, MRE.Material>;

    // constructor
	constructor(private _context: MRE.Context, private params: MRE.ParameterSet, _baseUrl: string) {
        this.context = _context;
        this.baseUrl = _baseUrl;
        this.assets = new MRE.AssetContainer(this.context);
        this.textures = new Map<string, MRE.Texture>();
        this.materials = new Map<string, MRE.Material>();

        // mainmenu button
        this.mainMenuMeshId = this.assets.createBoxMesh('main_menu_btn_mesh', MAIN_MENU_CELL_WIDTH, MAIN_MENU_CELL_HEIGHT, MAIN_MENU_CELL_DEPTH).id;
        this.mainMenuDefaultMaterialId = this.assets.createMaterial('main_menu_default_btn_material', { color: MRE.Color3.LightGray() }).id;
        this.mainMenuHighlightMeshId = this.assets.createBoxMesh('main_menu_highlight_mesh', MAIN_MENU_CELL_WIDTH+MAIN_MENU_CELL_MARGIN, MAIN_MENU_CELL_HEIGHT+MAIN_MENU_CELL_MARGIN, CELL_DEPTH/2).id;
        this.mainMenuHighlightMaterialId = this.assets.createMaterial('main_menu_highlight_btn_material', { color: MRE.Color3.Red() }).id;

        // mainmenu control
        this.mainMenuControlMeshId = this.assets.createBoxMesh('main_menu_control_btn_mesh', MAIN_MENU_CONTROL_CELL_WIDTH, MAIN_MENU_CONTROL_CELL_HEIGHT, MAIN_MENU_CONTROL_CELL_DEPTH).id;
        this.mainMenuControlDefaultMaterialId = this.assets.createMaterial('main_menu_control_default_btn_material', { color: MRE.Color3.LightGray() }).id;
        this.mainMenuControlHighlightMeshId = this.assets.createBoxMesh('main_menu_control_highlight_mesh', MAIN_MENU_CONTROL_CELL_WIDTH+MAIN_MENU_CONTROL_CELL_MARGIN, MAIN_MENU_CONTROL_CELL_HEIGHT+MAIN_MENU_CONTROL_CELL_MARGIN, MAIN_MENU_CONTROL_CELL_DEPTH/2).id;
        this.mainMenuControlHighlightMaterialId = this.assets.createMaterial('main_menu_control_highlight_btn_material', { color: MRE.Color3.Red() }).id;

        // inventory button
        this.meshId = this.assets.createBoxMesh('btn_mesh', CELL_WIDTH, CELL_HEIGHT, CELL_DEPTH).id;
        this.defaultMaterialId = this.assets.createMaterial('default_btn_material', { color: MRE.Color3.LightGray() }).id;
        this.highlightMeshId = this.assets.createBoxMesh('highlight_mesh', CELL_WIDTH+CELL_MARGIN, CELL_HEIGHT+CELL_MARGIN, CELL_DEPTH/2).id;
        this.highlightMaterialId = this.assets.createMaterial('highlight_btn_material', { color: MRE.Color3.Red() }).id;

        // inventory plane
        this.defaultPlaneMaterial = this.assets.createMaterial('default_btn_material', { color: MRE.Color3.DarkGray() });
        this.planeMeshId = this.assets.createPlaneMesh('plane_mesh', CELL_WIDTH, CELL_HEIGHT).id;

        // inventory control
        this.controlMeshId = this.assets.createBoxMesh('control_btn_mesh', CONTROL_CELL_WIDTH, CONTROL_CELL_HEIGHT, CONTROL_CELL_DEPTH).id;
        this.controlDefaultMaterialId = this.assets.createMaterial('control_default_btn_material', { color: MRE.Color3.LightGray() }).id;
        this.controlHighlightMeshId = this.assets.createBoxMesh('control_highlight_mesh', CONTROL_CELL_WIDTH+CONTROL_CELL_MARGIN, CONTROL_CELL_HEIGHT+CONTROL_CELL_MARGIN, CONTROL_CELL_DEPTH/2).id;
        this.controlHighlightMaterialId = this.assets.createMaterial('control_highlight_btn_material', { color: MRE.Color3.Red() }).id;

        // info panel
        this.infoPanelMaterialId = this.assets.createMaterial('info_panel_material', { color: MRE.Color3.LightGray() }).id;;

        // inventory equipment
        this.equipmentMenuMeshId = this.assets.createBoxMesh('equipment_menu_btn_mesh', EQUIPMENT_CELL_WIDTH, EQUIPMENT_CELL_HEIGHT, EQUIPMENT_CELL_DEPTH).id;
        this.equipmentMenuMaterialId = this.assets.createMaterial('equipment_menu_default_btn_material', { color: MRE.Color3.LightGray() }).id;
        this.equipmentMenuHighlightMeshId = this.assets.createBoxMesh('equipment_menu_highlight_mesh', EQUIPMENT_CELL_WIDTH+EQUIPMENT_CELL_MARGIN, EQUIPMENT_CELL_HEIGHT+EQUIPMENT_CELL_MARGIN, EQUIPMENT_CELL_DEPTH/2).id;
        this.equipmentMenuHighlightMaterialId = this.assets.createMaterial('equipment_menu_highlight_btn_material', { color: MRE.Color3.Red() }).id;
        this.equipmentMenuPlaneMeshId = this.assets.createPlaneMesh('equipment_menu_plane_mesh', EQUIPMENT_PLANE_WIDTH, EQUIPMENT_PLANE_HEIGHT).id;

        // user stats panel
        this.userStatsMeshId = this.assets.createBoxMesh('user_stats_btn_mesh', STATS_CELL_WIDTH, STATS_CELL_HEIGHT, STATS_CELL_DEPTH).id;
        this.userStatsMaterialId = this.assets.createMaterial('user_stats_material', { color: MRE.Color3.LightGray() }).id;;

        // shop menu
        this.shopMenuMeshId = this.assets.createBoxMesh('shop_menu_btn_mesh', SHOP_CELL_WIDTH, SHOP_CELL_HEIGHT, SHOP_CELL_DEPTH).id;
        this.shopMenuDefaultMaterialId = this.assets.createMaterial('shop_menu_default_btn_material', { color: MRE.Color3.LightGray() }).id;
        this.shopMenuHighlightMeshId = this.assets.createBoxMesh('shop_menu_highlight_mesh', SHOP_CELL_WIDTH+SHOP_CELL_MARGIN, SHOP_CELL_HEIGHT+SHOP_CELL_MARGIN, SHOP_CELL_DEPTH/2).id;
        this.shopMenuHighlightMaterialId = this.assets.createMaterial('shop_menu_highlight_btn_material', { color: MRE.Color3.Red() }).id;
        this.shopMenuPlaneMeshId = this.assets.createPlaneMesh('shop_menu_plane_mesh', SHOP_PLANE_WIDTH, SHOP_PLANE_HEIGHT).id;
        
        this.shopMenuInfoPanelMaterialId = this.assets.createMaterial('shop_menu_info_panel_material', { color: MRE.Color3.LightGray() }).id;

        this.shopMenuControlMeshId = this.assets.createBoxMesh('shop_menu_control_btn_mesh', SHOP_CONTROL_CELL_WIDTH, SHOP_CONTROL_CELL_HEIGHT, SHOP_CONTROL_CELL_DEPTH).id;
        this.shopMenuControlDefaultMaterialId = this.assets.createMaterial('shop_menu_control_default_btn_material', { color: MRE.Color3.LightGray() }).id;
        this.shopMenuControlHighlightMeshId = this.assets.createBoxMesh('shop_menu_control_highlight_mesh', SHOP_CONTROL_CELL_WIDTH+SHOP_CONTROL_CELL_MARGIN, SHOP_CONTROL_CELL_HEIGHT+SHOP_CONTROL_CELL_MARGIN, SHOP_CONTROL_CELL_DEPTH/2).id;
        this.shopMenuControlHighlightMaterialId = this.assets.createMaterial('shop_menu_control_highlight_btn_material', { color: MRE.Color3.Red() }).id;

        this.shopInventoryControlMeshId = this.assets.createBoxMesh('shop_inventory_control_btn_mesh', SHOP_INVENTORY_CONTROL_CELL_WIDTH, SHOP_INVENTORY_CONTROL_CELL_HEIGHT, SHOP_INVENTORY_CONTROL_CELL_DEPTH).id;
        this.shopInventoryControlDefaultMaterialId = this.assets.createMaterial('shop_inventory_control_default_btn_material', { color: MRE.Color3.LightGray() }).id;
        this.shopInventoryControlHighlightMeshId = this.assets.createBoxMesh('shop_inventory_control_highlight_mesh', SHOP_INVENTORY_CONTROL_CELL_WIDTH+SHOP_INVENTORY_CONTROL_CELL_MARGIN, SHOP_INVENTORY_CONTROL_CELL_HEIGHT+SHOP_INVENTORY_CONTROL_CELL_MARGIN, SHOP_INVENTORY_CONTROL_CELL_DEPTH/2).id;
        this.shopInventoryControlHighlightMaterialId = this.assets.createMaterial('shop_inventory_control_highlight_btn_material', { color: MRE.Color3.Red() }).id;

        // tools menu button
        this.toolsMenuMeshId = this.assets.createBoxMesh('tools_menu_btn_mesh', TOOLS_MENU_CELL_WIDTH, TOOLS_MENU_CELL_HEIGHT, TOOLS_MENU_CELL_DEPTH).id;
        this.toolsMenuDefaultMaterialId = this.assets.createMaterial('tools_menu_default_btn_material', { color: MRE.Color3.LightGray() }).id;
        this.toolsMenuHighlightMeshId = this.assets.createBoxMesh('tools_menu_highlight_mesh', TOOLS_MENU_CELL_WIDTH+TOOLS_MENU_CELL_MARGIN, TOOLS_MENU_CELL_HEIGHT+TOOLS_MENU_CELL_MARGIN, CELL_DEPTH/2).id;
        this.toolsMenuHighlightMaterialId = this.assets.createMaterial('tools_menu_highlight_btn_material', { color: MRE.Color3.Red() }).id;

        // sounds
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
        // data
        this.loadData();

        // ball        
        this.createBall();

        // main menu
        this.createMainMenu();
        this.createMainMenuControlStrip();

        // inventory menu
        this.createInventoryMenu();
        this.createInventoryMenuControlStrip();
        this.createInfoPanel();
        this.createEquipmentMenu();
        this.createUserStatsPanel();
        this.updateMenuPage( this.inventoryMenu, this.getInventoryPageData(), (d:ItemDescriptor) => d.count.toString() );

        // shop menu
        this.createShopMenu();
        this.createShopMenuInfoPanel();
        this.createShopMenuControlStrip();
        this.createShopInventoryControlStrip();
        this.updateMenuPage( this.shopMenu, this.getShopPageData() );

        // tools menu
        this.createToolsMenu();

        // scenes
        this.scenes.push(['main_menu', [this.mainMenu, this.mainMenuControlStrip]]);
        this.scenes.push(['inventory_menu', [this.inventoryMenu, this.inventoryControlStrip, this.infoPanel, this.equipmentMenu, this.userStatsPanel]]);
        this.scenes.push(['shop_menu', [this.shopMenu, this.shopMenuControlStrip, this.shopMenuInfoPanel, this.inventoryMenu, this.shopInventoryControlStrip, this.infoPanel ]]);
        this.scenes.push(['tools_menu', [this.toolsMenu]]);

        this.switchScene(''); // start from main menu
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

    //////////////
    //// scenes
    public switchScene(scene: string){
        if (this.currentScene == scene){
            return;
        }
        // default scene
        if (!this.scene.length && !this.scenes.map(e=>e[0]).includes(scene)) {
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

    /////////////////
    //// data
    private loadData(){
        this.itemDatabase = require('../public/data/items.json');
        this.userItems = [];

        this.userStats = {
            hp: 100,
            attack: 100,
            defense: 100,
            coins: 100
        }
    }

    public updateShopItemDescription(index: number){
        let item = this.itemDatabase[index];
        if (item === undefined) {return}
        let stat = (item.attack !== undefined) ? `attack: ${item.attack}` : `defense: ${item.defense}`
        let desc = 
       `
       name: ${item.name}
       cost: ${item.cost}
       ${stat}
       `;
        this.shopMenuInfoPanel.updateData([[{text: desc}]]);
    }

    public updateInventoryItemDescription(index: number){
        let item = this.userItems[index];
        if (item === undefined) {return}
        let stat = (item.attack !== undefined) ? `attack: ${item.attack}` : `defense: ${item.defense}`
        let desc = 
       `
       name: ${item.name}
       count: ${item.count}
       cost: ${item.cost}
       ${stat}
       `;
        this.infoPanel.updateData([[{text: desc}]]);
    }

    public getShopPageData(){
        let pageSize = SHOP_DIMENSIONS.x * SHOP_DIMENSIONS.y;
        return this.itemDatabase.slice(pageSize*(this.shopMenu.curPageNum-1), pageSize*this.shopMenu.curPageNum);
    }

    public getInventoryPageData(){
        let pageSize = INVENTORY_DIMENSIONS.x * INVENTORY_DIMENSIONS.y;
        return this.userItems.slice(pageSize*(this.inventoryMenu.curPageNum-1), pageSize*this.inventoryMenu.curPageNum);
    }

    public updateMenuPage(menu: GridMenu, pageData: ItemDescriptor[], desc?: (d: ItemDescriptor) => string){
        let f = (desc !== undefined) ? desc : (d:ItemDescriptor)=>d.name;
        let data = pageData.map(d => ({
            text: f(d),
            material: this.loadMaterial(d.name, d.obj.thumbnailUri)
        }));
        menu.updateData(menu.reshape(data));
    }

    public loadMaterial(name: string, uri: string){
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

    public addItemToInventory(item: ItemDescriptor){
        if (!this.itemIdToItem.has(item.id)){
            let it = cloneDeep(item)
            this.userItems.push(it);
            this.itemIdToItem.set(item.id, it);
        }else{
            this.itemIdToItem.get(item.id).count += 1;
        }
    }

    public buyItem(index: number){
        let item = this.itemDatabase[index];
        if (item === undefined) {return}
        if (this.userStats.coins < item.cost){
            this.shopMenuInfoPanel.updateData([[{text: 'Insufficient funds'}]]);
        } else {
            this.userStats.coins -= item.cost;
            this.addItemToInventory(item);
            this.shopMenuInfoPanel.updateData([[{text: `${item.name} added`}]]);
        }
    }

    public removeItemFromInventory(index: number){
        let item = this.userItems[index];
        if (item === undefined) {return}
        item.count -= 1;
        if (item.count <= 0){
            this.itemIdToItem.delete(item.id);
            return this.userItems.splice(index, 1)[0];
        }
    }

    public sellItem(index: number){
        let item = this.removeItemFromInventory(index);
        if (item) this.userStats.coins += item.cost;
    }

    /////////////////
    //// ball
    private createBall(){
        this.ball = new Button(this.context, {
            position: {x: 0, y: 0, z: 0},
            scale: {x: 1, y: 1, z: 1},
            text: '',
            enabled: true,
            meshId: this.assets.createSphereMesh('ball_mesh', RADIUS).id,
            materialId: this.assets.createMaterial('ball_material', { color: MRE.Color3.LightGray() }).id,
            layer: MRE.CollisionLayer.Hologram
        });
        this.ball.addBehavior((user,__) => {
            if (this.checkUserName(user, OWNER_NAME)){
                this.toggleMenu();
            } else{
                user.prompt("Text To Speech", true).then((dialog) => {
                    if (dialog.submitted) {
                        this.tts(dialog.text);
                    }
                });
            }
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

    private playSound(musicAsset: MRE.Sound, options?: playSoundOptions){
        let volume = (options.volume == undefined) ? 0.7 : options.volume;
        let rolloffStartDistance = (options.rolloffStartDistance == undefined) ? 15 : options.rolloffStartDistance;
        this.ball._button.startSound(musicAsset.id, {
            volume,
            rolloffStartDistance,
            looping: false
        });
    }

    private equipBall(user: MRE.User){
        this.ball._button.attach(user, 'left-hand');
    }

    public lockBall(){
        this.ball._button.grabbable = false;
    }

    public unlockBall(){
        this.ball._button.grabbable = true;
    }

    ////////////////
    //// menus
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
                row: MAIN_MENU_ITEMS.length,
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
            title: 'Main Menu',
            data
        });
    }

    private createMainMenuControlStrip(){
        let data = [ MAIN_MENU_CONTROL_ITEMS.map(t => ({
            text: t
        })) ];
        this.mainMenuControlStrip = new MainMenuControlStrip(this.context, this, {
            offset: {
                x: RADIUS,
                y: RADIUS - (MAIN_MENU_CONTROL_CELL_HEIGHT + MAIN_MENU_CONTROL_CELL_MARGIN)
            },
            shape: {
                row: 1,
                col: MAIN_MENU_CONTROL_ITEMS.length
            },
            cell: {
                width: MAIN_MENU_CONTROL_CELL_WIDTH,
                height: MAIN_MENU_CONTROL_CELL_HEIGHT,
                depth: MAIN_MENU_CONTROL_CELL_DEPTH,
                scale: MAIN_MENU_CONTROL_CELL_SCALE,
                textHeight: MAIN_MENU_CONTROL_CELL_TEXT_HEIGHT
            },
            margin: MAIN_MENU_CONTROL_CELL_MARGIN,
            meshId: this.mainMenuControlMeshId,
            defaultMaterialId: this.mainMenuControlDefaultMaterialId,
            highlightMeshId: this.mainMenuControlHighlightMeshId,
            highlightMaterialId: this.mainMenuControlHighlightMaterialId,
            parentId: this.ball._button.id,
            data
        });
    }

    private createInventoryMenu(){
        this.inventoryMenu = new InventoryMenu(this.context, this, {
            name: 'inventory',
            offset:{
                x: RADIUS,
                y: RADIUS
            },
            shape: {
                row: INVENTORY_DIMENSIONS.x,
                col: INVENTORY_DIMENSIONS.y
            },
            cell: {
                width: CELL_WIDTH,
                height: CELL_HEIGHT,
                depth: CELL_DEPTH,
                scale: CELL_SCALE,
                highlightDepth: CELL_DEPTH/2,
                textColor: MRE.Color3.White(),
                textHeight: 0.01,
                textAnchor: MRE.TextAnchorLocation.TopRight
            },
            plane: {
                width: CELL_WIDTH,
                height: CELL_HEIGHT
            },
            margin: CELL_MARGIN,
            meshId: this.meshId,
            defaultMaterialId: this.defaultMaterialId,
            highlightMeshId: this.highlightMeshId,
            highlightMaterialId: this.highlightMaterialId,
            planeMeshId: this.planeMeshId,
            parentId: this.ball._button.id,
            title: 'Inventory',
            defaultPlaneMaterial: this.defaultPlaneMaterial
        });
        this.inventoryMenu.offsetLabels({x: CELL_WIDTH/2, y: CELL_HEIGHT/2});
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
                row: INVENTORY_CONTROL_ITEMS.length,
                col: 1
            },
            cell: {
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
            margin: CELL_MARGIN,
            meshId: this.controlMeshId,
            defaultMaterialId: this.controlDefaultMaterialId,
            highlightMeshId: this.controlHighlightMeshId,
            highlightMaterialId: this.controlHighlightMaterialId,
            parentId: this.ball._button.id,
            data
        });
    }

    private createInfoPanel(){
        let data = [[{text: INFO_PANEL_PLACEHOLDER}]];
        // inventory info}
        let INFO_CELL_WIDTH = this.inventoryMenu.getMenuSize().width;
        this.infoPanelMeshId = this.assets.createBoxMesh('info_panel_mesh', INFO_CELL_WIDTH, INFO_CELL_HEIGHT, INFO_CELL_DEPTH).id;
        this.infoPanel = new InfoPanel(this.context, this, {
            offset: {
                x: RADIUS,
                y: RADIUS - (INFO_CELL_HEIGHT + INFO_CELL_MARGIN)
            },
            shape: {
                row: 1,
                col: 1
            },
            cell: {
                width: INFO_CELL_WIDTH,
                height: INFO_CELL_HEIGHT,
                depth: INFO_CELL_DEPTH,
                scale: INFO_CELL_SCALE,
                textHeight: INFO_CELL_TEXT_HEIGHT
            },
            margin: CELL_MARGIN,
            meshId: this.infoPanelMeshId,
            defaultMaterialId: this.infoPanelMaterialId,
            parentId: this.ball._button.id,
            data
        });
    }

    private createEquipmentMenu(){
        let data = EQUIPMENT_ITEMS.map(t => [{
            text: t + ':item#1\n' + 'cost:100\n' + 'attack:100'
        }]);
        this.equipmentMenu = new EquipmentMenu(this.context, this, {
            offset:{
                x: RADIUS + this.inventoryMenu.getMenuSize().width + CONTROL_CELL_MARGIN + this.inventoryControlStrip.getMenuSize().width + EQUIPMENT_CELL_MARGIN,
                y: RADIUS
            },
            shape: {
                row: EQUIPMENT_ITEMS.length,
                col: 1
            },
            cell: {
                width: EQUIPMENT_CELL_WIDTH,
                height: EQUIPMENT_CELL_HEIGHT,
                depth: EQUIPMENT_CELL_DEPTH,
                scale: EQUIPMENT_CELL_SCALE,
                highlightDepth: EQUIPMENT_CELL_DEPTH/2,
                textHeight: EQUIPMENT_CELL_TEXT_HEIGHT
            },
            plane: {
                width: EQUIPMENT_PLANE_WIDTH,
                height: EQUIPMENT_PLANE_HEIGHT
            },
            margin: EQUIPMENT_CELL_MARGIN,
            meshId: this.equipmentMenuMeshId,
            defaultMaterialId: this.equipmentMenuMaterialId,
            highlightMeshId: this.equipmentMenuHighlightMeshId,
            highlightMaterialId: this.equipmentMenuHighlightMaterialId,
            planeMeshId: this.equipmentMenuPlaneMeshId,
            parentId: this.ball._button.id,
            data,
            title: 'Equipment',
            defaultPlaneMaterial: this.defaultPlaneMaterial
        });
        this.equipmentMenu.offsetMenu({
            x: 0,
            y: (this.inventoryMenu.getMenuSize().height - this.equipmentMenu.getMenuSize().height)
            // asssuming inventory menu is taller
        });
        this.equipmentMenu.planesAlignLeft();
        this.equipmentMenu.labelsRightToPlane();
    }

    private createShopMenu(){
        this.shopMenu = new ShopMenu(this.context, this, {
            name: 'shop',
            offset:{
                x: RADIUS,
                y: RADIUS
            },
            shape: {
                row: SHOP_DIMENSIONS.x,
                col: SHOP_DIMENSIONS.y
            },
            cell: {
                width: SHOP_CELL_WIDTH,
                height: SHOP_CELL_HEIGHT,
                depth: SHOP_CELL_DEPTH,
                scale: SHOP_CELL_SCALE,
                highlightDepth: SHOP_CELL_DEPTH/2,
                textColor: MRE.Color3.White(),
                textHeight: 0.01,
                textAnchor: MRE.TextAnchorLocation.TopRight
            },
            plane: {
                width: SHOP_CELL_WIDTH,
                height: SHOP_CELL_HEIGHT
            },
            margin: SHOP_CELL_MARGIN,
            meshId: this.shopMenuMeshId,
            defaultMaterialId: this.shopMenuDefaultMaterialId,
            highlightMeshId: this.shopMenuHighlightMeshId,
            highlightMaterialId: this.shopMenuHighlightMaterialId,
            planeMeshId: this.shopMenuPlaneMeshId,
            parentId: this.ball._button.id,
            title: 'Shop',
            defaultPlaneMaterial: this.defaultPlaneMaterial
        });
        this.shopMenu.offsetLabels({x: SHOP_CELL_WIDTH/2, y: SHOP_CELL_HEIGHT/2});
    }

    private createShopMenuInfoPanel(){
        let data = [[{text: SHOP_INFO_PANEL_PLACEHOLDER}]];
        // inventory info
        let SHOP_INFO_CELL_WIDTH = this.shopMenu.getMenuSize().width;
        this.shopMenuInfoPanelMeshId = this.assets.createBoxMesh('shop_menu_info_panel_mesh', SHOP_INFO_CELL_WIDTH, SHOP_INFO_CELL_HEIGHT, SHOP_INFO_CELL_DEPTH).id;
        this.shopMenuInfoPanel = new InfoPanel(this.context, this, {
            offset: {
                x: RADIUS,
                y: RADIUS - (INFO_CELL_HEIGHT + INFO_CELL_MARGIN)
            },
            shape: {
                row: 1,
                col: 1
            },
            cell: {
                width: SHOP_INFO_CELL_WIDTH,
                height: SHOP_INFO_CELL_HEIGHT,
                depth: SHOP_INFO_CELL_DEPTH,
                scale: SHOP_INFO_CELL_SCALE,
                textHeight: SHOP_INFO_CELL_TEXT_HEIGHT
            },
            margin: SHOP_CELL_MARGIN,
            meshId: this.shopMenuInfoPanelMeshId,
            defaultMaterialId: this.shopMenuInfoPanelMaterialId,
            parentId: this.ball._button.id,
            data
        });
    }

    private createShopMenuControlStrip(){
        let data = SHOP_CONTROL_ITEMS.map(t => [{
            text: t
        }]);
        let size = this.shopMenu.getMenuSize();
        this.shopMenuControlStrip = new ShopMenuControlStrip(this.context, this, {
            offset: {
                x: RADIUS + size.width + SHOP_CONTROL_CELL_MARGIN,
                y: RADIUS
            },
            shape: {
                row: SHOP_CONTROL_ITEMS.length,
                col: 1
            },
            cell: {
                width: SHOP_CONTROL_CELL_WIDTH,
                height: SHOP_CONTROL_CELL_HEIGHT,
                depth: SHOP_CONTROL_CELL_DEPTH,
                scale: SHOP_CONTROL_CELL_SCALE,
                textHeight: SHOP_CONTROL_CELL_TEXT_HEIGHT
            },
            margin: SHOP_CONTROL_CELL_MARGIN,
            meshId: this.shopMenuControlMeshId,
            defaultMaterialId: this.shopMenuControlDefaultMaterialId,
            highlightMeshId: this.shopMenuControlHighlightMeshId,
            highlightMaterialId: this.shopMenuControlHighlightMaterialId,
            parentId: this.ball._button.id,
            data
        });
    }

    private createShopInventoryControlStrip(){
        let data = SHOP_INVENTORY_CONTROL_ITEMS.map(t => [{
            text: t
        }]);
        this.shopInventoryControlStrip = new ShopInventoryControlStrip(this.context, this, {
            offset: {
                x: RADIUS + this.shopMenu.getMenuSize().width + SHOP_CELL_MARGIN + this.shopMenuControlStrip.getMenuSize().width + CELL_MARGIN + this.inventoryMenu.getMenuSize().width + SHOP_INVENTORY_CONTROL_CELL_MARGIN,
                y: RADIUS
            },
            shape: {
                row: SHOP_INVENTORY_CONTROL_ITEMS.length,
                col: 1
            },
            cell: {
                width: SHOP_INVENTORY_CONTROL_CELL_WIDTH,
                height: SHOP_INVENTORY_CONTROL_CELL_HEIGHT,
                depth: SHOP_INVENTORY_CONTROL_CELL_DEPTH,
                scale: SHOP_INVENTORY_CONTROL_CELL_SCALE,
                textHeight: SHOP_INVENTORY_CONTROL_CELL_TEXT_HEIGHT
            },
            margin: SHOP_INVENTORY_CONTROL_CELL_MARGIN,
            meshId: this.shopInventoryControlMeshId,
            defaultMaterialId: this.shopInventoryControlDefaultMaterialId,
            highlightMeshId: this.shopInventoryControlHighlightMeshId,
            highlightMaterialId: this.shopInventoryControlHighlightMaterialId,
            parentId: this.ball._button.id,
            data
        });
    }

    private createToolsMenu(){
        let data = TOOLS_MENU_ITEMS.map(t => [{
            text: t
        }]);
        this.toolsMenu = new ToolsMenu(this.context, this, {
            offset: {
                x: RADIUS,
                y: RADIUS
            },
            shape: {
                row: TOOLS_MENU_ITEMS.length,
                col: 1
            },
            cell: {
                width: TOOLS_MENU_CELL_WIDTH,
                height: TOOLS_MENU_CELL_HEIGHT,
                depth: TOOLS_MENU_CELL_DEPTH,
                scale: TOOLS_MENU_CELL_SCALE
            },
            margin: TOOLS_MENU_CELL_MARGIN,
            meshId: this.toolsMenuMeshId,
            defaultMaterialId: this.toolsMenuDefaultMaterialId,
            highlightMeshId: this.toolsMenuHighlightMeshId,
            highlightMaterialId: this.toolsMenuHighlightMaterialId,
            parentId: this.ball._button.id,
            title: 'Tools',
            data
        });
    }

    private createUserStatsPanel(){
        let data = [[{text: OWNER_NAME}]];
        // user stats
        this.userStatsPanel = new UserStatsPanel(this.context, this, {
            offset: {
                x: RADIUS + this.inventoryMenu.getMenuSize().width + CONTROL_CELL_MARGIN + this.inventoryControlStrip.getMenuSize().width + STATS_CELL_MARGIN,
                y: RADIUS - (STATS_CELL_HEIGHT + STATS_CELL_MARGIN)
            },
            shape: {
                row: 1,
                col: 1
            },
            cell: {
                width: STATS_CELL_WIDTH,
                height: STATS_CELL_HEIGHT,
                depth: STATS_CELL_DEPTH,
                scale: STATS_CELL_SCALE,
                textHeight: STATS_CELL_TEXT_HEIGHT
            },
            margin: CELL_MARGIN,
            meshId: this.userStatsMeshId,
            defaultMaterialId: this.userStatsMaterialId,
            parentId: this.ball._button.id,
            data
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

    ///////////////////
    //// tts
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

    ////////////////
    //// utils

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

    private checkUserName(user: MRE.User, name: string){
        return user.name == name;
    }

}
