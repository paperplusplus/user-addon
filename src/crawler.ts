import superagent from 'superagent';
import cheerio from 'cheerio';

const email = process.env['EMAIL'];
const password = process.env['PASSWORD'];

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
            console.log(kits[i]);
        }
        console.log(JSON.stringify(items));
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

(async ()=>{
    let crawler = new AltVRCrawler();
    crawler.get_kits([
        '1150502900485587047',
        '1150502900485587047?page=2',
        '1150502900485587047?page=3',
        '1150502900485587047?page=4',
        '1150502900485587047?page=5',
        '1150502900485587047?page=6',
        '1150502900485587047?page=7'
    ]);
})();