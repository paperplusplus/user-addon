import * as MRE from '@microsoft/mixed-reality-extension-sdk';
import { MreArgumentError } from '@microsoft/mixed-reality-extension-sdk';

export interface ButtonOptions {
    name?: string,
    position?: Partial<MRE.Vector3Like>,
    rotation?: MRE.Vector3Like,
    scale?: MRE.Vector3Like,
    text?: string,
    color?:MRE.Color3,
    enabled?: boolean,
    layer?: MRE.CollisionLayer,
    parentId?: MRE.Guid,
    planeMeshId?: MRE.Guid,
    meshId: MRE.Guid,
    materialId: MRE.Guid,
    defaultPlaneMaterialId: MRE.Guid, // debug
    buttonDepth: number
}

export interface GridLayoutOptions {
    shape?: {
        row: number,
        col: number
    },
    margin?: number,
    cell?: CellDimensions,
    data?: CellData[][],
    planeMeshId?: MRE.Guid,
    meshId: MRE.Guid,
    defaultMaterialId: MRE.Guid,
    defaultPlaneMaterialId: MRE.Guid // debug
}

export interface CellDimensions{
    width: number,
    height: number,
    depth: number,
    scale?: number
}

export interface CellData{
    text?: string,
    materialId?: MRE.Guid
}

export class GridMenu {
    // unity
    private context: MRE.Context;
    private _menu: MRE.Actor;
    private assets: MRE.AssetContainer;

    private meshId: MRE.Guid;
    private planeMeshId: MRE.Guid;
    private defaultMaterialId: MRE.Guid;

    // debug
    private defaultPlaneMaterialId: MRE.Guid;

    private cell: CellDimensions;
    private data: CellData[][];
    private margin: number;

    // logic
    private buttons = new Map<string, Button>();

    constructor(_context: MRE.Context, options?: GridLayoutOptions){
        this.context = _context;
        new MRE.AssetContainer(this.context);

        let row = (options.shape.row == undefined) ? 1 : options.shape.row;
        let col = (options.shape.col == undefined) ? 1 : options.shape.col;
        this.cell = (options.cell == undefined) ? this.defaultCellDimensions() : options.cell;
        this.margin =(options.margin == undefined) ? 0.1 : options.margin;

        this.defaultMaterialId = options.defaultMaterialId;
        this.meshId = options.meshId;
        this.planeMeshId = options.planeMeshId;
        this.defaultPlaneMaterialId = options.defaultPlaneMaterialId; // debug

        // default data depends on defaultMaterialId
        this.data = (options.data == undefined) ? this.defaultGridLayoutData(row, col) : options.data;
        this.createGrid(row, col);
    }

    private createGrid(row: number, col: number){
        this._menu = MRE.Actor.Create(this.context, {});
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
                        materialId: d.materialId,
                        planeMeshId: this.planeMeshId,
                        defaultPlaneMaterialId: this.defaultPlaneMaterialId
                    }
                );
                this.buttons.set(name, btn);
                btn.addBehavior((__,_) => {});
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
}

export class Button {
    private _text: string;
    private _color: MRE.Color3;
    private enabled: boolean;

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
        let enabled = (options.enabled !== undefined) ? options.enabled : true;
        let layer = (options.layer !== undefined) ? options.layer : MRE.CollisionLayer.Default;

        this._text = (options.text !== undefined) ? options.text : '?';
        this._color = (options.color !== undefined) ? options.color : MRE.Color3.Black();

        let meshId = options.meshId;
        let materialId = options.materialId;
        let buttonDepth = options.buttonDepth;
        let planeMeshId = options.planeMeshId;

        // debug
        let planeMaterialId = options.defaultPlaneMaterialId;

        this._box = MRE.Actor.Create(context, {
            actor: {
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
				transform: {
					app: { position: {x: position.x, y: position.y, z: position.z - buttonDepth - 0.0001} }
				},
				text: {
					contents: this._text,
					anchor: MRE.TextAnchorLocation.MiddleCenter,
                    color: this._color,
					height: 0.05
				}
			}
        });

        if (planeMeshId != undefined){
            this._picture = MRE.Actor.Create(context, {
                actor: {
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
}