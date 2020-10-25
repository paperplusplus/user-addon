import fs from 'fs';
import util from 'util';
import crypto from 'crypto';

import * as MRE from '@microsoft/mixed-reality-extension-sdk';

const geotz = require('geo-tz');
const moment = require('moment-timezone');
const textToSpeech = require('@google-cloud/text-to-speech');
const sha256 = (x:string) => crypto.createHash('sha256').update(x, 'utf8').digest('hex');

import fetchJSON from './fetchJSON';
import server from './server';

const API_KEY = process.env['API_KEY'];

// CONFIGARABLES.
const JOINED_SOUND_DURATION = 4860;
const LEFT_SOUND_DURATION = 3200;
const DELAY_BETWEEN_SOUNDS = 100;

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

    private box: MRE.Actor;

    //tts
    private ttsClient = new textToSpeech.TextToSpeechClient();

    // constructor
	constructor(private _context: MRE.Context, private params: MRE.ParameterSet, _baseUrl: string) {
        this.context = _context;
        this.baseUrl = _baseUrl;
        this.assets = new MRE.AssetContainer(this.context);

        this.joinedSound = this.assets.createSound('joined', { uri: `${this.baseUrl}/joined.ogg` });
        this.leftSound = this.assets.createSound('left', { uri: `${this.baseUrl}/left.ogg` });

        this.box = MRE.Actor.Create(this.context, {
            actor: {
                    transform: {
                        local: {
                            position: {x: 0, y: 0, z: 0},
                            scale: {x: 1, y: 1, z: 1}
                        }
                    },
                    appearance: {
                        enabled: false,
                        meshId: this.assets.createBoxMesh('box_mesh', 0.1, 0.1, 0.1).id,
                        materialId: this.assets.createMaterial('box_material', { color: MRE.Color3.LightGray() }).id
                    },
                    collider: { 
                        geometry: { shape: MRE.ColliderType.Auto },
                        layer: MRE.CollisionLayer.Hologram
                    }
                }
            }
        );

        this.context.onStarted(() => this.init());
        this.context.onUserJoined(user => this.userJoined(user));
        this.context.onUserLeft(user => this.userLeft(user));

        let tz = 'Asia/Shanghai';
        let mmt = moment.tz(tz).format();
        console.log(mmt);
	}

	/**
	 * Once the context is "started", initialize the app.
	 */
	private init() {

    }

    private userJoined(user: MRE.User){
        this.playSound(this.joinedSound);
        setTimeout(() => {
            this.greet(user);
        }, JOINED_SOUND_DURATION + DELAY_BETWEEN_SOUNDS);
    }

    private userLeft(user: MRE.User){
        this.playSound(this.leftSound);
        setTimeout(() => {
            this.bye(user);
        }, LEFT_SOUND_DURATION + DELAY_BETWEEN_SOUNDS);
    }

    private playSound(musicAsset: MRE.Sound){
        this.box.startSound(musicAsset.id, {
            volume: 0.5,
            looping: false,
            rolloffStartDistance: 2.5
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

        let name = u.name;
        let loc = await this.ip2location(u.ip);

        if (isNaN(loc.lat) && isNaN(loc.lng)){
            let tz = geotz(loc.lat, loc.lng);
            tz = 'Asia/Shanghai';
            let mmt = moment.tz(tz);
        }
        let tz = 'Asia/Shanghai';
        let hour = moment.tz(tz).hour();
        let greet = "Good " + (hour<12 && "Morning" || hour<18 && "Afternoon" || "Evening");

        this.tts(`${greet}, ${name}`);
    }

    private bye(user: MRE.User){
    }

    private async tts(text: string){
        const request = {
            input: {text: text},
            // Select the language and SSML voice gender (optional)
            voice: {languageCode: 'en-US', ssmlGender: 'NEUTRAL'},
            // select the type of audio encoding
            audioConfig: {audioEncoding: 'MP3'},
          };
        const [response] = await this.ttsClient.synthesizeSpeech(request);
        const fileName = sha256(text) + '.mp3';
        const writeFile = util.promisify(fs.writeFile);
        await writeFile(fileName, response.audioContent, 'binary');
        const sound = this.assets.createSound(fileName, { uri: `${this.baseUrl}/${fileName}` });
        this.playSound(sound);
    }
}