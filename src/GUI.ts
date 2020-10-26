import * as MRE from '@microsoft/mixed-reality-extension-sdk';
import { MreArgumentError } from '@microsoft/mixed-reality-extension-sdk';

export interface ButtonOptions {
    name?: string,
    position?: Partial<MRE.Vector3Like>,
    scale?: MRE.Vector3Like,
    text?: string,
    color?:MRE.Color3,
    rotation?: MRE.Vector3Like,
    parentId: MRE.Guid,
    meshId: MRE.Guid,
    materialId: MRE.Guid,
    buttonDepth: number
}

export interface GridLayoutOptions {
    shape: {
        row: number,
        col: number
    },
    margin: number,
    cell: {
        width: number,
        height: number,
        depth: number,
        scale?: number
    },
    data: CellData[][]
}

export interface CellData{
    text: string,
    materialId: MRE.Guid
}

export abstract class GridMenu {
    // unity
    private context: MRE.Context;
    private menu: MRE.Actor;
    private assets: MRE.AssetContainer;

    private meshId: MRE.Guid;
    private defaultBtnMaterialId: MRE.Guid;

    // consts
    private CELL_WIDTH: number;
    private CELL_HEIGHT: number;
    private CELL_DEPTH: number;
    private CELL_SCALE: number;

    private CELL_MARGIN: number;

    // logic
    private buttons = new Map<string, Button>();

    constructor(_context: MRE.Context, options?: GridLayoutOptions){
        this.context = _context;

        // parent actor
        this.menu = MRE.Actor.Create(this.context, {});

        this.CELL_WIDTH = (options.cell.width == undefined) ? 0.1 : options.cell.width;
        this.CELL_HEIGHT = (options.cell.height == undefined) ? 0.1 : options.cell.height;
        this.CELL_DEPTH = (options.cell.depth == undefined) ? 0.1 : options.cell.depth;
        this.CELL_SCALE = (options.cell.scale == undefined) ? 1 : options.cell.scale;
        this.CELL_MARGIN = (options.margin == undefined) ? 0.01 : options.margin;

        let row = (options.shape.row == undefined) ? 1 : options.shape.row;
        let col = (options.shape.col == undefined) ? 1 : options.shape.col;

        let data = (options.data == undefined) ? this.defaultGridLayoutData(row, col) : options.data;

        this.meshId = this.assets.createBoxMesh('btn_mesh', this.CELL_WIDTH, this.CELL_HEIGHT, this.CELL_DEPTH).id;
        this.defaultBtnMaterialId = this.assets.createMaterial('default_btn_material', { color: MRE.Color3.LightGray() }).id;

        this.createGrid(row, col, data);
    }

    private createGrid(row: number, col: number, data: CellData[][]){
        let w = this.CELL_WIDTH;
        let h = this.CELL_HEIGHT;

        for (let ri=0; ri<row; ri++){
            for (let ci=0; ci<col; ci++){
                let name = "btn_"+ri+"_"+ci;
                let d = data[ri][ci];
                let btn = new Button(this.context, 
                    {
                        name,
                        position: { 
                            x: ci * (this.CELL_WIDTH + this.CELL_MARGIN) + w/2,
                            y: (row - ri - 1) * (this.CELL_HEIGHT + this.CELL_MARGIN) + h/2,
                            z: 0
                        },
                        scale: { x: this.CELL_SCALE, y: this.CELL_SCALE, z: this.CELL_SCALE },
                        buttonDepth: this.CELL_DEPTH,
                        parentId: this.menu.id,
                        meshId: this.meshId,
                        text: d.text,
                        materialId: d.materialId
                    }
                );
                this.buttons.set(name, btn);
            }
        };
    }

    private defaultGridLayoutData(row: number, col: number){
        return [...Array(row)].map((x,r) => [...Array(col)].map((y,c) => ({
            text: '',
            materialId: this.defaultBtnMaterialId
        })));
    }
}

export class Button {
    private _text: string;
    private _color: MRE.Color3;

    private _box: MRE.Actor;
    private _label: MRE.Actor;
    private _picture: MRE.Actor;

    private buttonBehavior: MRE.ButtonBehavior;

    get _button(){
        return this._box;
    }

    get text(){
        return this._text;
    }

    constructor(context: MRE.Context, options?: ButtonOptions){
        let position = (options.position !== undefined) ? options.position : { x: 0, y: 0, z: 0 };
        let scale = (options.scale !== undefined) ? options.scale : { x: 1, y: 1, z: 1 };
        this._text = (options.text !== undefined) ? options.text : '?';
        this._color = (options.color !== undefined) ? options.color : MRE.Color3.Black();

        let meshId = options.meshId;
        let materialId = options.materialId;
        let buttonDepth = options.buttonDepth;

        this._box = MRE.Actor.Create(context, {
            actor: {
                appearance: {
                    meshId,
                    materialId
                },
                transform: {
                    local: {
                        position,
                        scale
                    }
                },
                collider: { geometry: { shape: MRE.ColliderType.Auto } }
            }
        });

        this._label = MRE.Actor.Create(context, {
			actor: {
				name: 'Text',
				transform: {
					app: { position: {x: position.x, y: position.y, z: position.z - buttonDepth/2 - 0.0001} }
				},
				text: {
					contents: this._text,
					anchor: MRE.TextAnchorLocation.MiddleCenter,
                    color: this._color,
					height: 0.05
				}
			}
        });
        
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

    public onClickEventHandler(name: string, row: number, col: number){

    }
}