import * as MRE from '@microsoft/mixed-reality-extension-sdk';
import { MreArgumentError, Vector2 } from '@microsoft/mixed-reality-extension-sdk';
import Inventory from './app';

const OWNER_NAME = process.env['OWNER_NAME'];

export interface ButtonOptions {
    name?: string,
    position?: Partial<MRE.Vector3Like>,
    rotation?: MRE.Vector3Like,
    scale?: MRE.Vector3Like,
    text?: string,
    textHeight?: number,
    color?:MRE.Color3,
    enabled?: boolean,
    layer?: MRE.CollisionLayer,
    parentId?: MRE.Guid,
    planeMeshId?: MRE.Guid,
    meshId: MRE.Guid,
    materialId: MRE.Guid,
    defaultPlaneMaterialId?: MRE.Guid, // debug
    buttonDepth: number
}

export interface GridMenuOptions {
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
        textHeight?: number
    },
    margin?: number,
    data?: CellData[][],
    meshId: MRE.Guid,
    defaultMaterialId: MRE.Guid,
    highlightMeshId: MRE.Guid,
    highlightMaterialId: MRE.Guid,
    planeMeshId?: MRE.Guid,
    parentId?: MRE.Guid,
    defaultPlaneMaterialId?: MRE.Guid // debug
}

export interface CellData{
    text?: string,
    materialId?: MRE.Guid
}

export abstract class GridMenu {
    protected app: Inventory;
    // unity
    protected context: MRE.Context;
    private _menu: MRE.Actor;
    private assets: MRE.AssetContainer;

    private meshId: MRE.Guid;
    private defaultMaterialId: MRE.Guid;

    private highlightMeshId: MRE.Guid;
    private highlightMaterialId: MRE.Guid;
    private planeMeshId: MRE.Guid;

    private parentId: MRE.Guid;

    // debug
    private defaultPlaneMaterialId: MRE.Guid;

    private row: number;
    private col: number;
    private cell: GridMenuOptions['cell'];
    private offset: GridMenuOptions['offset'];
    private data: CellData[][];
    private margin: number;

    // logic
    private buttons = new Map<string, Button>();
    private highlightButton: Button;
    private highlightedButtonCoord: Vector2;
    private isHighlighted: boolean = false;

    // interface
    abstract onItemClick(coord: Vector2, name: string, user: MRE.User): void;

    // get 
    get root() {return this._menu};
    get highlighted() {return this.isHighlighted};

    constructor(_context: MRE.Context, _app: Inventory, options?: GridMenuOptions){
        this.context = _context;
        this.app = _app;
        // this.assets = new MRE.AssetContainer(this.context);

        this.row = (options.shape.row == undefined) ? 1 : options.shape.row;
        this.col = (options.shape.col == undefined) ? 1 : options.shape.col;
        this.offset = (options.offset == undefined) ? {x: 0, y: 0}: options.offset;
        this.cell = (options.cell == undefined) ? this.defaultCellDimensions() : options.cell;
        this.margin =(options.margin == undefined) ? 0.1 : options.margin;

        this.meshId = options.meshId;
        this.defaultMaterialId = options.defaultMaterialId;

        this.highlightMeshId = options.highlightMeshId;
        this.highlightMaterialId = options.highlightMaterialId;
        this.planeMeshId = options.planeMeshId;
        this.defaultPlaneMaterialId = options.defaultPlaneMaterialId; // debug

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
                buttonDepth: this.cell.highlightDepth,
                parentId: this._menu.id,
                meshId: this.highlightMeshId,
                text: '',
                materialId: this.highlightMaterialId,
                defaultPlaneMaterialId: this.defaultPlaneMaterialId
            }
        );
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
                        buttonDepth: this.cell.depth,
                        parentId: this._menu.id,
                        meshId: this.meshId,
                        text: d.text,
                        textHeight: this.cell.textHeight,
                        materialId: d.materialId,
                        planeMeshId: this.planeMeshId,
                        defaultPlaneMaterialId: this.defaultPlaneMaterialId
                    }
                );
                this.buttons.set(name, btn);
                btn.addBehavior((user,_) => {
                    this.onClick(new Vector2(ri, ci), name, user);
                });
            }
        };
    }

    private defaultGridLayoutData(row: number, col: number){
        let materialId = this.defaultMaterialId;
        return [...Array(row)].map((x,r) => [...Array(col)].map((y,c) => ({
            text: '',
            materialId
        })));
    }

    private defaultCellDimensions(){
        return {
            width: 1,
            height: 1,
            depth: 1,
            scale: 1
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
}

export class Button {
    private _text: string;
    private _color: MRE.Color3;
    private textHeight: number;
    private enabled: boolean;

    private _box: MRE.Actor;
    private _label: MRE.Actor;
    private _picture: MRE.Actor;

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

        let meshId = options.meshId;
        let materialId = options.materialId;
        let buttonDepth = options.buttonDepth;
        let planeMeshId = options.planeMeshId;

        // debug
        let planeMaterialId = options.defaultPlaneMaterialId;

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
					local: { position: {x: position.x, y: position.y, z: position.z - buttonDepth - 0.0001} }
				},
				text: {
					contents: this._text,
					anchor: MRE.TextAnchorLocation.MiddleCenter,
                    color: this._color,
					height: this.textHeight
				}
			}
        });

        if (planeMeshId != undefined){
            this._picture = MRE.Actor.Create(context, {
                actor: {
                    parentId,
                    appearance: {
                        meshId: planeMeshId,
                        materialId: planeMaterialId,
                        enabled
                    },
                    transform: {
                        local: {
                            scale,
                            position: {x: position.x, y: position.y, z: position.z - buttonDepth/2 - 0.0001},
                            rotation: MRE.Quaternion.FromEulerAngles(-90 * MRE.DegreesToRadians, 0 * MRE.DegreesToRadians, 0 * MRE.DegreesToRadians),
                        }
                    }
                }
            });
        }
        
        this.buttonBehavior = this._button.setBehavior(MRE.ButtonBehavior);
    }

    public addBehavior(handler: MRE.ActionHandler<MRE.ButtonEventData>){
        this.buttonBehavior.onClick(handler);
    }

    public updateLabel(text: string, _color?: MRE.Color3){
        let color = (_color !== undefined) ? _color : MRE.Color3.Black();
        this._label.text.contents = text;
        this._label.text.color = color;
    }

    public updateColor(_color: MRE.Color3){
        this._button.appearance.material.color = new MRE.Color4(_color.r, _color.g, _color.b, 1);
    }

    public enable(){
        this._button.appearance.enabled = true;
    }

    public disable(){
        this._button.appearance.enabled = false;
    }
}