import React from "react";
import * as themes from '../../themes'

// Values will be default satoshis everywhere
var units = [
    {
        id: 0,
        symbol: "sats",
        conversionName: "satoshi",
        displayName: "Satoshis",
        multiplier: 1
    },
    {
        id: 1,
        symbol: "BTC",
        displayName: "BTC",
        conversionName: "btc",
        multiplier: 100000000
    }
];

pushNewUnit = (symbol, displayName, multiplier) => {
    units.push({
        id: units.length,
        conversionName: "fiat",
        symbol,
        displayName,
        multiplier
    });
}

addFiatUnits = async () => {
    try {
        // Get prices
        let response = await fetch("https://min-api.cryptocompare.com/data/price?fsym=BTC&tsyms=USD,EUR,GBP");
        let prices = await response.json();
        pushNewUnit("$", "USD", prices.USD);
        pushNewUnit("€", "EUR", prices.EUR);
        pushNewUnit("£", "GBP", prices.GBP);
    } catch (error) { }
}

addFiatUnits();
export { units };

export const ThemeContext = React.createContext({
    theme: themes.standard,
    themeChanged: false,
    changeTheme: () => { },
    createStyle: () => { },
    loadTheme: () => { }
});

export const UnitContext = React.createContext({
    unit: units[1],
    changeUnit: () => { },
    cycleUnits: () => { },
    unitConverter: () => { },
    loadUnit: () => { }
});

export const BLEContext = React.createContext({
    connected: false,
    manager: null,
    services: null,
    characteristics: null,
    listen: () => { },
    broadcast: () => { },
    connect: () => { }
});

export const CombinedContext = React.createContext();

const languages = [
    { id: 0, shortCode: 'en', displayName: 'English' },
    { id: 1, shortCode: 'lv', displayName: 'Latviešu' },
    { id: 2, shortCode: 'ru', displayName: 'Pусский' }
];

export const LanguageContext = React.createContext({
    lang: languages[0],
    languages,
    cycleLanguages: () => { },
    changeLanguage: () => { },
    loadLanguage: () => { },
    translate: () => { }
});
export { languages };