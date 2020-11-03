import * as MRE from '@microsoft/mixed-reality-extension-sdk';
import { Vector2 } from '@microsoft/mixed-reality-extension-sdk';
import { off } from 'superagent';
import { Inventory } from './app';

const OWNER_NAME = process.env['OWNER_NAME'];

export interface ButtonOptions {
    name?: string,
    position?: Partial<MRE.Vector3Like>,
    rotation?: MRE.Vector3Like,
    scale?: MRE.Vector3Like,
    text?: string,
    textHeight?: number,
    color?: MRE.Color3,
    anchor?: MRE.TextAnchorLocation,
    enabled?: boolean,
    layer?: MRE.CollisionLayer,
    parentId?: MRE.Guid,
    planeMeshId?: MRE.Guid,
    meshId: MRE.Guid,
    materialId: MRE.Guid,
    planeMaterial?: MRE.Material,
    buttonDimensions?: {
        width: number,
        height: number,
        depth: number
    },
    planeDimensions?: {
        width?: number,
        height?: number
    }
}

// plane must be defined if provided planeMeshId
export interface GridMenuOptions {
    name?: string,
    offset?:{
        x: number,
        y: number
    }
    shape?: {
        row: number,
        col: number
    },
    cell?: {
        width: number,
        height: number,
        depth: number,
        highlightDepth?: number,
        scale?: number,
        textHeight?: number,
        textColor?: MRE.Color3,
        textAnchor?: MRE.TextAnchorLocation
    },
    plane?:{
        width: number,
        height: number
    }
    margin?: number,
    data?: CellData[][],
    title?: string,
    titleTextHeight?: number,
    meshId: MRE.Guid,
    defaultMaterialId: MRE.Guid,
    highlightMeshId?: MRE.Guid,
    highlightMaterialId?: MRE.Guid,
    planeMeshId?: MRE.Guid,
    defaultPlaneMaterial?: MRE.Material,
    parentId?: MRE.Guid,
}

export interface CellData{
    text?: string,
    material?: MRE.Material
}

export abstract class GridMenu {
    protected app: Inventory;
    // unity
    protected context: MRE.Context;
    private _menu: MRE.Actor;
    private _label: MRE.Actor;
    private assets: MRE.AssetContainer;

    private meshId: MRE.Guid;
    private defaultMaterialId: MRE.Guid;

    private highlightMeshId: MRE.Guid;
    private highlightMaterialId: MRE.Guid;
    private planeMeshId: MRE.Guid;

    private parentId: MRE.Guid;

    // debug
    private name: string;
    private defaultPlaneMaterial: MRE.Material;

    private row: number;
    private col: number;
    private cell: GridMenuOptions['cell'];
    private plane: GridMenuOptions['plane'];
    private offset: GridMenuOptions['offset'];
    private data: CellData[][];
    private title: string;
    private titleTextHeight: number;
    private margin: number;

    // logic
    private buttons = new Map<string, Button>();
    private highlightButton: Button;
    private highlightedButtonCoord: Vector2;
    private isHighlighted: boolean = false;

    private _curPageNum: number = 1;

    // interface
    abstract onItemClick(coord: Vector2, name: string, user: MRE.User): void;

    // get 
    get root() {return this._menu};
    get highlighted() {return this.isHighlighted};
    get coord() {return this.highlightedButtonCoord};
    get curPageNum() {return this._curPageNum};
    get _row() {return this.row};
    get _col() {return this.col};

    constructor(_context: MRE.Context, _app: Inventory, options?: GridMenuOptions){
        this.context = _context;
        this.app = _app;
        this.assets = new MRE.AssetContainer(this.context);

        this.row = (options.shape.row == undefined) ? 1 : options.shape.row;
        this.col = (options.shape.col == undefined) ? 1 : options.shape.col;
        this.offset = (options.offset == undefined) ? {x: 0, y: 0}: options.offset;
        this.cell = (options.cell == undefined) ? this.defaultCellDimensions() : options.cell;
        this.plane = (options.plane == undefined) ? {width: this.cell.width, height: this.cell.height}: options.plane;
        this.margin =(options.margin == undefined) ? 0.1 : options.margin;

        this.title = options.title;
        this.titleTextHeight = (options.titleTextHeight == undefined) ? 0.05 : options.titleTextHeight;

        this.meshId = options.meshId;
        this.defaultMaterialId = options.defaultMaterialId;

        this.highlightMeshId = options.highlightMeshId;
        this.highlightMaterialId = options.highlightMaterialId;
        this.planeMeshId = options.planeMeshId;
        this.defaultPlaneMaterial = options.defaultPlaneMaterial; // debug
        this.name = options.name;

        this.parentId = (options.parentId == undefined) ? null : options.parentId;

        // default data depends on defaultMaterialId
        this.data = (options.data == undefined) ? this.defaultGridLayoutData(this.row, this.col) : options.data;

        // parent
        this._menu = MRE.Actor.Create(this.context, {
            actor:{ 
                transform: { 
                    local: { position: { x: this.offset.x, y: this.offset.y } }
                },
                parentId: this.parentId
            }
        });

        // cells
        this.createGrid(this.row, this.col);
        this.createHighlightButton();

        // title
        if (this.title != undefined){
            this.createTitle();
        }
    }

    private createGrid(row: number, col: number){
        for (let ri=0; ri<row; ri++){
            for (let ci=0; ci<col; ci++){
                let name = "btn_"+ri+"_"+ci;
                let d = this.data[ri][ci];
                let btn = new Button(this.context, 
                    {
                        name,
                        layer: MRE.CollisionLayer.Hologram,
                        position: { 
                            x: ci * (this.cell.width + this.margin) + this.cell.width/2,
                            y: (row - ri - 1) * (this.cell.height + this.margin) + this.cell.height/2,
                            z: 0
                        },
                        scale: { x: this.cell.scale, y: this.cell.scale, z: this.cell.scale },
                        buttonDimensions: { width: this.cell.width, height: this.cell.height, depth: this.cell.depth },
                        planeDimensions: this.plane,
                        parentId: this._menu.id,
                        meshId: this.meshId,
                        text: d.text,
                        textHeight: this.cell.textHeight,
                        color: this.cell.textColor,
                        anchor: this.cell.textAnchor,
                        materialId: this.defaultMaterialId,
                        planeMeshId: this.planeMeshId,
                        planeMaterial: (d.material !== undefined) ? d.material: this.defaultPlaneMaterial
                    }
                );
                this.buttons.set(name, btn);
                btn.addBehavior((user,_) => {
                    this.onClick(new Vector2(ri, ci), name, user);
                });
            }
        };
    }

    private createHighlightButton(){
        this.highlightedButtonCoord = new Vector2(0,0);
        this.highlightButton= new Button(this.context, 
            {
                name: 'highlight',
                layer: MRE.CollisionLayer.Hologram,
                position: { 
                    x: this.highlightedButtonCoord.y * (this.cell.width + this.margin) + this.cell.width/2,
                    y: (this.row - this.highlightedButtonCoord.x - 1) * (this.cell.height + this.margin) + this.cell.height/2,
                    z: 0
                },
                scale: { x: this.cell.scale, y: this.cell.scale, z: this.cell.scale },
                enabled: false,
                buttonDimensions: { width: (this.cell.width + this.margin), height: (this.cell.height + this.margin), depth: this.cell.highlightDepth },
                parentId: this._menu.id,
                meshId: this.highlightMeshId,
                text: '',
                materialId: this.highlightMaterialId
            }
        );
    }

    private createTitle(){
        let size = this.getMenuSize();
        this._label = MRE.Actor.Create(this.context, {
			actor: {
                name: 'title_text',
                parentId: this._menu.id,
				transform: {
					local: { 
                        position: {
                            x: size.width/2,
                            y: size.height + this.titleTextHeight/2 + this.margin,
                            z: 0
                        } 
                    }
				},
				text: {
					contents: this.title,
                    anchor: MRE.TextAnchorLocation.MiddleCenter,
                    color: MRE.Color3.White(),
					height: this.titleTextHeight
				}
			}
        });
    }

    public defaultCellData(): CellData{
        return {
            text: '',
            material: this.defaultPlaneMaterial
        }
    }

    private defaultGridLayoutData(row: number, col: number): CellData[][]{
        let material = this.defaultPlaneMaterial;
        return [...Array(row)].map((x,r) => [...Array(col)].map((y,c) => ({
            text: '',
            material
        })));
    }

    // convert 1d-array to 2d-array
    public reshape(arr: CellData[]){
        let fill = this.row * this.col - arr.length;
        for (let i=0; i<fill; i++){
            arr.push(this.defaultCellData());
        }

        let ret = [];
        while(arr.length) { ret.push(arr.splice(0,this.col)); }
        return ret;
    }

    private defaultCellDimensions(){
        return {
            width: 1,
            height: 1,
            depth: 1,
            scale: 1
        }
    }
    
    private defaultPlaneDimensions(){
        return {
            width: 1,
            height: 1
        }
    }

    public getMenuSize(){
        return {
            width: this.col * this.cell.width + (this.col-1) * this.margin,
            height: this.row * this.cell.height + (this.row-1) * this.margin
        }
    }

    private checkUserName(user: MRE.User, name: string){
        return user.name == name;
    }

    private onClick(coord: Vector2, name: string, user: MRE.User){
        if (this.checkUserName(user, OWNER_NAME)){
            this.onItemClick(coord, name, user);
        }
    }

    public highlight(coord: Vector2){
        // click on highlight or not
        if (this.isHighlighted && coord.equals(this.highlightedButtonCoord)){
            this.highlightButton.disable();
            this.isHighlighted = false;
        }
        else{
            this.highlightButton.enable();
            this.isHighlighted = true;
        }
        // update highlight
        this.highlightedButtonCoord = coord;
        this.moveHighlightTo(this.highlightedButtonCoord);
    }

    public getHighlightedIndex(coord: Vector2){
        let pageSize = this.row * this.col;
        return (this.curPageNum - 1) * pageSize + ( coord.x*this.col + coord.y );
    }
    
    private moveHighlightTo(coord: Vector2){
        this.highlightButton._button.transform.local.position.x = this.highlightedButtonCoord.y * (this.cell.width + this.margin) + this.cell.width/2;
        this.highlightButton._button.transform.local.position.y = (this.row - this.highlightedButtonCoord.x - 1) * (this.cell.height + this.margin) + this.cell.height/2;
    }

    public disable(){
        this._menu.appearance.enabled = false;
        this._menu.transform.local.position.z = this.cell.depth*2;
    }

    public enable(){
        this._menu.appearance.enabled = true;
        this._menu.transform.local.position.z = 0;
    }

    public offsetMenu(offset: {x: number, y: number}){
        this._menu.transform.local.position.x += offset.x;
        this._menu.transform.local.position.y += offset.y;
    }

    public offsetLabels(offset: {x: number, y: number}){
        this.buttons.forEach(b=>{b.offsetLabel(offset)});
    }

    public planesAlignLeft(){
        this.buttons.forEach(b=>{b.planeAlignLeft()});
    }

    public labelsRightToPlane(){
        this.buttons.forEach(b=>{b.labelRightToPlane()});
    }

    public updateData(data: CellData[][]){
        if (data.length < this.row) {return;}
        for (let i=0; i<data.length; i++){
            for (let j=0; j<data[i].length; j++){
                let d = data[i][j];
                let n = 'btn_'+i+'_'+j;
                let b = this.buttons.get(n);
                if (b !== undefined) { 
                    if (d.text !== undefined) { b.updateLabel(d.text); }
                    if (d.material !== undefined) { b.updateMaterial(b._plane, d.material); }
                }
            }
        }
    }

    private getPageNum(total: number){
        let pageSize = this.row * this.col;
        return total/pageSize + ((total%pageSize == 0) ? 0 : 1);
    }

    public incrementPageNum(total: number){
        if (this._curPageNum < this.getPageNum(total)-1){
            this._curPageNum += 1;
        }
    }

    public decrementPageNum(){
        if (this._curPageNum > 1){
            this._curPageNum -= 1;
        }
    }
}

export class Button {
    private _text: string;
    private _color: MRE.Color3;
    private anchor: MRE.TextAnchorLocation;
    private textHeight: number;

    private _box: MRE.Actor;
    private _label: MRE.Actor;
    private _picture: MRE.Actor;

    private buttonDimensions: ButtonOptions['buttonDimensions'];
    private planeDimensions: ButtonOptions['planeDimensions'];
    private planeMeshId: MRE.Guid;
    private planeMaterial: MRE.Material;

    private buttonBehavior: MRE.ButtonBehavior;

    get _button(){
        return this._box;
    }

    get _plane(){
        return this._picture;
    }

    get text(){
        return this._text;
    }

    constructor(context: MRE.Context, options?: ButtonOptions){
        let position = (options.position !== undefined) ? options.position : { x: 0, y: 0, z: 0 };
        let scale = (options.scale !== undefined) ? options.scale : { x: 1, y: 1, z: 1 };
        let enabled = (options.enabled !== undefined) ? options.enabled : true;
        let layer = (options.layer !== undefined) ? options.layer : MRE.CollisionLayer.Default;
        let parentId = (options.parentId !== undefined) ? options.parentId : null;

        this._text = (options.text !== undefined) ? options.text : '?';
        this._color = (options.color !== undefined) ? options.color : MRE.Color3.Black();
        this.textHeight = (options.textHeight !== undefined) ? options.textHeight : 0.05;
        this.anchor = (options.anchor !== undefined) ? options.anchor : MRE.TextAnchorLocation.MiddleCenter;

        let meshId = options.meshId;
        let materialId = options.materialId;
        this.buttonDimensions = (options.buttonDimensions !== undefined) ? options.buttonDimensions : {width: 0, height: 0, depth: 0};
        this.planeDimensions = (options.planeDimensions !== undefined) ? options.planeDimensions : {width: this.buttonDimensions.width, height: this.buttonDimensions.height};
        this.planeMeshId = options.planeMeshId;

        // debug
        this.planeMaterial = options.planeMaterial;

        this._box = MRE.Actor.Create(context, {
            actor: {
                parentId,
                appearance: {
                    meshId,
                    materialId,
                    enabled
                },
                transform: {
                    local: {
                        position,
                        scale
                    }
                },
                collider: { 
                    geometry: { shape: MRE.ColliderType.Auto },
                    layer
                }
            }
        });

        this._label = MRE.Actor.Create(context, {
			actor: {
                name: 'Text',
                parentId,
				transform: {
					local: { position: {x: position.x, y: position.y, z: position.z - this.buttonDimensions.depth - 0.0001} }
				},
				text: {
					contents: this._text,
					anchor: this.anchor,
                    color: this._color,
					height: this.textHeight
				}
			}
        });

        if (this.planeMeshId != undefined){
            this._picture = MRE.Actor.Create(context, {
                actor: {
                    parentId,
                    appearance: {
                        meshId: this.planeMeshId,
                        materialId: this.planeMaterial.id,
                        enabled
                    },
                    transform: {
                        local: {
                            scale,
                            position: {
                                x: position.x,
                                y: position.y,
                                z: position.z - this.buttonDimensions.depth/2 - 0.0001
                            },
                            rotation: MRE.Quaternion.FromEulerAngles(-90 * MRE.DegreesToRadians, 0 * MRE.DegreesToRadians, 0 * MRE.DegreesToRadians),
                        }
                    }
                }
            });
        }
        
        this.buttonBehavior = this._button.setBehavior(MRE.ButtonBehavior);
    }

    public planeAlignLeft(){
        this._picture.transform.local.position.x += (this.planeDimensions.width - this.buttonDimensions.width)/2;
    }

    public labelRightToPlane(){
        this._label.transform.local.position.x += (this.planeDimensions.width - this.buttonDimensions.width/2) + 0.01;
        this._label.text.anchor = MRE.TextAnchorLocation.MiddleLeft;
    }

    public addBehavior(handler: MRE.ActionHandler<MRE.ButtonEventData>){
        this.buttonBehavior.onClick(handler);
    }

    public updateLabel(text: string, color?: MRE.Color3){
        this._label.text.contents = text;
        this._label.text.color = color;
    }

    public offsetLabel(offset: {x: number, y: number}){
        this._label.transform.local.position.x += offset.x;
        this._label.transform.local.position.y += offset.y;
    }

    public updateColor(_color: MRE.Color3){
        this._button.appearance.material.color = new MRE.Color4(_color.r, _color.g, _color.b, 1);
    }

    public updateMaterial(actor: MRE.Actor, material: MRE.Material){
        actor.appearance.material = material;
    }

    public enable(){
        this._button.appearance.enabled = true;
    }

    public disable(){
        this._button.appearance.enabled = false;
    }
}