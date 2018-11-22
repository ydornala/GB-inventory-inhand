import readXlsxFile from 'read-excel-file/node';
import axios from 'axios';
var createCsvWriter = require('csv-writer').createObjectCsvWriter;

const BASE_URL = 'https://ccadmin-test-zeba.oracleoutsourcing.com';
let locations = {};
let access_token;

const csvWriter = createCsvWriter({
    path: './results.csv',
    header: [
        {id: 'id', title: 'Item #'},
        {id: 'status', title: 'Status'}
    ]
});

let records = [];
 
const http = axios.create({
    baseURL: BASE_URL
});

const responseFile = (records) => {
    csvWriter.writeRecords(records)       // returns a promise
        .then(() => {
            console.log('results.csv file created...');
        });
}

const login = () => {
    http.post('/ccadmin/v1/login/', 'grant_type=client_credentials', {
        headers: {
            'content-type': 'application/x-www-form-urlencoded',
            Authorization: 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIzZWZjNTVkNy0yYjNmLTQ3YWYtYTkyYS1jYjFmYWI3NzQ4ZGIiLCJpc3MiOiJhcHBsaWNhdGlvbkF1dGgiLCJleHAiOjE1NzI1MDg3MDUsImlhdCI6MTU0MDk3MjcwNX0=.8Jlk9A+jTBqpkNGTNkBAjI9kYXuXUcXTTriRQK7NkPQ='
        },
    }).then(res => {
        access_token = res.data.access_token;

        listLocations();
    }, err => {
        console.log('err', err);        
    });
}

const listLocations = () => {
    http.get('/ccadmin/v1/locations', {
        headers: {
            Authorization: 'Bearer ' + access_token
        },
    }).then(res => {
        // console.log('succ locations', res.data);
        const data = res.data;

        const items = data.items;
        locations = {};
        items.forEach(item => {
             locations[item.externalLocationId] = item.locationId
        });
        
        readExcel();
    }, err => {
        console.log('err loc', err);        
    });
}

const createInventory = (data) => {    
    http.post('/ccadmin/v1/inventories', data, {
        headers: {
            'content-type': 'application/json',
            Authorization: 'Bearer ' + access_token
        },
    }).then(res => {
        const data = res.data;

        console.log('createa success ', data);
        records.push({
            id: data.skuId,
            status: 'success'
        });

    }, err => {
        // console.log('err create inv', err.response.data);
        const errResponce = err.response.data;
        if(errResponce.errorCode == '25120') {
            updateInventory(data);
        }
    });
}

const updateInventory = (data) => {
    const id = data.id;
    delete data.id;
    
    http.put('/ccadmin/v1/inventories/' + id, data, {
        headers: {
            'content-type': 'application/json',
            Authorization: 'Bearer ' + access_token
        },
    }).then(res => {
        const rs = res.data;

        records.push({
            id: rs.skuId,
            status: 'success'
        });
                
        responseFile(records);
    }, err => {
        console.log('err loc', err.response.data, err);
    });
}

const readExcel = () => {
    readXlsxFile('./Inventory-in-hand.xlsx')
        .then((rows) => {
            records = [];

            rows.forEach((element, index) => {

                if(index === 0) return;
                
                const data = {
                    "locationId": locations[element[1]],
                    "id": element[2],
                    "stockLevel": element[6]
                };

                createInventory(data);
            });        
    });
}

login();