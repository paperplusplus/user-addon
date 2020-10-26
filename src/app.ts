import fs from 'fs';
import util from 'util';
import crypto from 'crypto';
import path from 'path';

import * as MRE from '@microsoft/mixed-reality-extension-sdk';
const text2wav = require('text2wav');

const sha256 = (x:string) => crypto.createHash('sha256').update(x, 'utf8').digest('hex');

const geotz = require('geo-tz');
const moment = require('moment-timezone');

import fetchJSON from './fetchJSON';
import {GridMenu, Button} from './GUI';
import { CollisionLayer } from '@microsoft/mixed-reality-extension-sdk';

const API_KEY = process.env['API_KEY'];

// CONFIGARABLES.
const JOINED_SOUND_DURATION = 4860;
const LEFT_SOUND_DURATION = 3200;
const DELAY_BETWEEN_SOUNDS = 100;

const BOX_WIDTH=0.3;
const BOX_HEIGHT=0.3;
const BOX_DEPTH=0.3;

type weaponDescriptor = {
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

interface playSoundOptions{
    rolloffStartDistance?: number;
    volume?: number;
}

class InventoryMenu extends GridMenu{
}

/**
 * The main class of this app. All the logic goes here.
 */
export default class Inventory {

    // unity
    private context: MRE.Context;
    private baseUrl: string;
    private assets: MRE.AssetContainer;

    private joinedSound: MRE.Sound;
    private leftSound: MRE.Sound;


    // logic
    private menu: InventoryMenu;
    private box: Button;

    // constructor
	constructor(private _context: MRE.Context, private params: MRE.ParameterSet, _baseUrl: string) {
        this.context = _context;
        this.baseUrl = _baseUrl;
        this.assets = new MRE.AssetContainer(this.context);

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
        this.createBox();
    }

    private createBox(){
        this.box = new Button(this.context, {
            position: {x: 0, y: 0, z: 0},
            scale: {x: 1, y: 1, z: 1},
            text: '',
            enabled: true,
            meshId: this.assets.createBoxMesh('box_mesh', BOX_WIDTH, BOX_HEIGHT, BOX_DEPTH).id,
            materialId: this.assets.createMaterial('box_material', { color: MRE.Color3.LightGray() }).id,
            buttonDepth: 0.1,
            layer: MRE.CollisionLayer.Hologram
        });
        this.box.addBehavior((user,__) => {
            user.prompt("Text To Speech", true).then((dialog) => {
                if (dialog.submitted) {
                    this.tts(dialog.text);
                }
            });
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
        this.box._button.startSound(musicAsset.id, {
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
        fs.appendFile(filePath, Buffer.from(o), (err) => {
            if(err){ console.log(err);}
            const sound = this.assets.createSound(fileName, { uri: `${this.baseUrl}/${fileName}` });
            this.playSound(sound, {});
        });
    }
}
