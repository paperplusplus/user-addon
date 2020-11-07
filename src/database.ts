import fs from 'fs';
import path from 'path';
import superagent from 'superagent';
import cheerio from 'cheerio';
import { fetchJSON } from './utils';
const { getAudioDurationInSeconds } = require('get-audio-duration');

const email = process.env['EMAIL'];
const password = process.env['PASSWORD'];

type ObjectDescriptor = {
    thumbnailUri: string;
    resourceId: string;
    attachPoint?: string;
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
export interface ItemDescriptor {
    id: number,
    name: string,
    type?: string,
    attack?: number,
    defense?: number,
    count?: number
    cost?: number,
    obj?: ObjectDescriptor
}

export class AltVRCrawler{
    constructor(){
    }

    public async get_kits(kits: string[]){
        let items: any = [];
        let token = await this.get_token();
        let cookie = await this.login(token);
        for (let i=0; i<kits.length; i++){
            let text = await this.get_kit(kits[i], cookie);
            let il = this.parseText(text)
            items.push(...il);
        }
        items = items.map((e:any, i:number) => ({
            obj: {
                thumbnailUri: e.thumbnailUri,
                resourceId: `artifact:${e.artifactId}`,
                attachPoint: 'head'
            },
            id: i,
            name: e.name,
            type: 'Helmet',
            defense: 1,
            count: 1,
            cost: 1
        }));
        JSON.stringify(items, null, 4)
        fs.writeFile('./public/data/data.json', JSON.stringify(items, null, 4), (err)=>{if(err) console.log(err);});
    }

    private async get_token(){
        let url = "https://account.altvr.com/users/sign_in";
        let headers = {
            "User-Agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/54.0.2840.71 Safari/537.36",
            'Content-Type':'application/x-www-form-urlencoded'
        };
        return new Promise<string>(function(resolve, reject) {
            superagent.get(url).set(headers).end(function (err, response) {
                if (err) {reject}
                let $ = cheerio.load(response.text);
                resolve($("meta[name=csrf-token]").attr('content'));
            });
        });
    }

    private async login(token: string){
        let url = "https://account.altvr.com/users/sign_in";
        let headers = {
            "User-Agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/54.0.2840.71 Safari/537.36",
            'Content-Type':'application/x-www-form-urlencoded'
        };
        return new Promise<string[]>(function(resolve, reject) {
            superagent.post(url).set(headers).send({
                'utf8': '✓',
                'user[tz_offset]': '-480',
                'user[remember_me]': '0',
                'authenticity_token': token,
                'user[email]': email,
                'user[password]': password
            }).redirects(0).end(function (err, response) {
                console.log(response.text);
                if (err) {reject}
                let cookie: string[] = response.headers["set-cookie"];
                resolve(cookie);
            });
        });
    }

    private async get_kit(kitId: string, cookie: string[]) {
        let headers = {
            "User-Agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/54.0.2840.71 Safari/537.36",
            'Content-Type':'application/x-www-form-urlencoded'
        };

        let url = "https://account.altvr.com/kits/"+kitId;

        return new Promise<string>(function(resolve, reject) {
            superagent.get(url).set({Cookie: cookie}).set(headers).end(function (err, response) {
                if (err) {reject}
                resolve(response.text);
            });
        });
    }

    private parseText(text: string){
        let items: any = [];
        let $ = cheerio.load(text);
        $("div.body div.col-right").children().eq(1).children('p').each((i,e) => {
            let n = $(e);
            let t = n.text().split(/\n/).filter(x => x);
            let it = { 
                name: t[0],
                artifactId: t[1],
                thumbnailUri: n.children('img').attr('src') ,
            };
            items.push(it);
        });
        return items;
    }
}

export type DadJoke = {
  id: number,
  type: string,
  setup: string,
  punchline: string
}

export enum JOKE_TYPE {
    KNOCK_KNOCK = "knock-knock",
    GENERAL = "general"
}

export async function getJoke(type: JOKE_TYPE): Promise<DadJoke[]>{
    let url = "http://us-central1-dadsofunny.cloudfunctions.net/DadJokes/random/type";
    const res = await fetchJSON(`${url}/${type}`);
    return res;
}

export type Meme = {
    name: string,
    uri: string,
    duration?: number
}

export class MemeCrawler{
    constrcutor(){
    }

    public async crawl_page(page: number){
        let baseUrl = `https://www.myinstants.com`;
        let url = `https://www.myinstants.com/search/?page=${page}`;
        let headers = {
            "User-Agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/54.0.2840.71 Safari/537.36",
            'Content-Type':'application/x-www-form-urlencoded'
        };
        return new Promise<Meme[]>(function(resolve, reject) {
            superagent.get(url).set(headers).end(function (err, response) {
                if (err) {reject}
                let $ = cheerio.load(response.text);
                let items: Meme[] = [];
                $("div#instants_container div.instant").children('div.small-button').each((i,e) => {
                    let n = $(e);
                    let u = n.attr("onmousedown");
                    let name = n.siblings('a').text();
                    let _uri = /\/.*mp3/.exec(u);
                    if (_uri) {
                        let uri = _uri[0];
                        uri = `${baseUrl}${uri}`;
                        let it = {
                            name,
                            uri
                        }
                        items.push(it);
                    }
                    else{
                        console.log(page, name, u);
                    }
                });
                resolve(items);
            });
        });
    }

    public async crawl(){
        let items = [];
        for(let i=1; i<27; i++){
            items.push(...await this.crawl_page(i));
        }
        return items;
    }

    public async downloadFile(uri: string){
        let headers = {
            "User-Agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/54.0.2840.71 Safari/537.36",
            'Content-Type':'application/x-www-form-urlencoded'
        };
        return new Promise<string>(function(resolve, reject) {
            let fileName = path.basename(uri);
            let filePath = `./public/data/${fileName}`;
            if (!fs.existsSync(filePath)){
                console.log(filePath);
                superagent.get(uri).set(headers).pipe(fs.createWriteStream(filePath));
            }
        });
    }

    public async duration(items: Meme[]){
        for (let i=0; i<items.length; i++){
            let fileName = path.basename(items[i].uri);
            let filePath = `./public/data/${fileName}`;
            await getAudioDurationInSeconds(filePath).then((duration: number) => {
                items[i].duration = duration;
            });
        }
        return items;
    }
}

// (async ()=>{
//     let crawler = new AltVRCrawler();
//     crawler.get_kits([
//         '1150502900485587047',
//         '1150502900485587047?page=2',
//         '1150502900485587047?page=3',
//         '1150502900485587047?page=4',
//         '1150502900485587047?page=5',
//         '1150502900485587047?page=6',
//         '1150502900485587047?page=7'
//     ]);
// })();

// (async ()=>{
//     let crawler = new MemeCrawler();
//     // let memes = await crawler.crawl();
//     // fs.writeFile('./public/data/meme.json', JSON.stringify(memes, null, 4), (err)=>{if(err) console.log(err);});
//     // let memes: Meme[] = require('../public/data/memes.json');
//     // for (let i=0; i<memes.length; i++){
//     //     crawler.downloadFile(memes[i].uri);
//     // }
//     let memes: Meme[] = require('../public/data/memes.json');
//     await crawler.duration(memes);
//     fs.writeFile('./public/data/memes2.json', JSON.stringify(memes, null, 4), (err)=>{if(err) console.log(err);});
// })();

// (async ()=>{
//     let crawler = new AltVRCrawler();
//     crawler.get_kits([
//         '1162013411748348872?page=1',
//         '1162013411748348872?page=2',
//         '1162013411748348872?page=3',
//         '1162013411748348872?page=4',
//         '1162013411748348872?page=5',
//         '1162013411748348872?page=6'
//     ]);
// })();
