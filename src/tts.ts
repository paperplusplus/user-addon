import * as MRE from '@microsoft/mixed-reality-extension-sdk';
import { parseUser, ip2location } from './utils';
const text2wav = require('text2wav');
const geotz = require('geo-tz');
const moment = require('moment-timezone');

export async function greet(user: MRE.User){
    let u = parseUser(user);
    console.log(u);

    let name = u.name;
    let loc = await ip2location(u.ip);
    console.log(loc);

    let tz;
    if (isNaN(loc.lat) && isNaN(loc.lng) || loc.lat==null && loc.lng==null){
        tz = 'Asia/Shanghai';
    } else{
        tz = geotz(loc.lat, loc.lng)[0];
    }
    let hour = moment.tz(tz).hour();
    let greet = "Good " + (hour>=4 && hour<12 && "Morning" || hour>=12 && hour<18 && "Afternoon" || "Evening");

    tts(`${greet}, ${name}, welcome to the spaceship`);
}

export function bye(user: MRE.User){
    let u = parseUser(user);

    let name = u.name;
    tts(`${name} has left the spaceship`);
}

export async function tts(text: string){
    console.log(text);
    let o;
    try{
        o = await text2wav(text);
    }catch(err){
        console.log(err);
        return;
    }
    return o;
}