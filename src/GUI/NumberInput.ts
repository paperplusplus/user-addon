import * as MRE from '@microsoft/mixed-reality-extension-sdk';
import { checkUserName } from '../utils';
import { GridMenu, GridMenuOptions } from './gridMenu';

const OWNER_NAME = process.env['OWNER_NAME'];

export class NumberInput extends GridMenu{
    constructor(_context: MRE.Context, options?: GridMenuOptions){
        options.shape = { row: 1, col: 3 };
        options.data = [[
            {text: '-'},
            {text: ''},
            {text: '+'}
        ]];
        super(_context, options);
    }
    
    public updateText(text: string){
        text = text.slice(0,5);
        let data = [[
            {text: '-'},
            {text},
            {text: '+'}
        ]];
        this.updateCells(data);
    }

    public onDecrease(stepUp: ()=>void){
        let interval: NodeJS.Timeout = null;
        let button = this.buttons.get('btn_0_0');
        button.addHoldingBehavior((user, _)=>{
            if (checkUserName(user, OWNER_NAME)){
                interval = setInterval(stepUp, 10);
            }
        });
        button.addReleaseBehavior((user, _)=>{
            if (checkUserName(user, OWNER_NAME)){
                clearInterval(interval);
            }
        });
        button.addBehavior((user, _)=>{
            if (checkUserName(user, OWNER_NAME)){
                stepUp();
            }
        });
    }

    public onIncrease(stepDown: ()=>void){
        let interval: NodeJS.Timeout = null;
        let button = this.buttons.get('btn_0_2');
        button.addHoldingBehavior((user, _)=>{
            if (checkUserName(user, OWNER_NAME)){
                interval = setInterval(stepDown, 100);
            }
        });
        button.addReleaseBehavior((user, _)=>{
            if (checkUserName(user, OWNER_NAME)){
                clearInterval(interval);
            }
        });
        button.addBehavior((user)=>{
            if (checkUserName(user, OWNER_NAME)){
                stepDown();
            }
        });
    }

    public onEdit(edit: (user: MRE.User)=>void){
        this.buttons.get('btn_0_1').addBehavior((user, _)=>{
            if (checkUserName(user, OWNER_NAME)){
                edit(user);
            }
        });
    }
}