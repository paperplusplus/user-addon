import * as MRE from '@microsoft/mixed-reality-extension-sdk';
import { get } from 'http';

const API_KEY = process.env['API_KEY'];

////////////////
//// utils
export function fetchJSON(url: string): Promise<any> {
	return new Promise((resolve, reject) => {
		get(url, res => {
			const { statusCode } = res;
			const contentType = res.headers['content-type'] as string;

			let error;
			if (statusCode !== 200) {
				error = new Error('Request Failed.\n' +
					`Status Code: ${statusCode}`);
			} else if (!/^application\/json/.test(contentType)) {
				error = new Error('Invalid content-type.\n' +
					`Expected application/json but received ${contentType}`);
			}
			if (error) {
				reject(error.message);
				// consume response data to free up memory
				res.resume();
				return;
			}

			res.setEncoding('utf8');
			let rawData = '';
			res.on('data', (chunk) => { rawData += chunk; });
			res.on('end', () => {
				try {
					const parsedData = JSON.parse(rawData);
					resolve(parsedData);
				} catch (e) {
					reject(e.message);
				}
			});
		});
	});
}
export function parseUser(user: MRE.User){
    let ra = user.properties['remoteAddress'];
    let ipv4 = ra.split(':').pop();
    return {
        id: user.id,
        name: user.name,
        device: user.properties['device-model'],
        ip: ipv4
    }
}

export async function ip2location(ip: string){
    console.log(`http://api.ipapi.com/${ip}?access_key=${API_KEY}`);
    const res = await fetchJSON(`http://api.ipapi.com/${ip}?access_key=${API_KEY}`);
    return {
        lat: res.latitude,
        lng: res.longitude,
        cc: res.country_code,
        country: res.country_name
    }
}

export function checkUserName(user: MRE.User, name: string){
    return user.name == name;
}