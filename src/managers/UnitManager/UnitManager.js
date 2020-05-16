/* eslint-disable */
import React, { Component } from 'react';
import Reactotron from 'reactotron-react-native';
import AsyncStorage from '@react-native-community/async-storage';
import btcConvert from 'bitcoin-units';
import { UnitContext, units } from '../StateManager/Contexts';

// Use this in headers
btcConvert.setDisplay('btc', {
    format: '฿ {amount}'
});

btcConvert.setDisplay('satoshi', {
    format: '{amount} sats'
});

export class UnitProvider extends Component {
    constructor(props) {
        super(props);

        this.componentDidMount = () => {
            this.loadCoinUnit();
        }

        this.loadCoinUnit = async () => {
            let UnitPresent = await AsyncStorage.getItem('activeUnit')
            if (!UnitPresent) {
                Reactotron.log('Default unit set: ', units[1]);
                await AsyncStorage.setItem('activeUnit', JSON.stringify(units[1]))
            }
            else {
                Reactotron.log('Unit Loaded: ', UnitPresent);
                this.setState({ unit: JSON.parse(UnitPresent) });
            }
        }

        this.changeUnit = async (unit) => {
            Reactotron.log('previous selected unit', this.state.unit);
            this.setState({ unit });
            await AsyncStorage.setItem('activeUnit', JSON.stringify(unit));
        }

        this.cycleUnits = () => {
            Reactotron.log('here')
            let oldValue = this.state.unit.id;
            let newValue = oldValue >= units.length - 1 ? 0 : oldValue + 1;
            Reactotron.log(oldValue, newValue)
            this.changeUnit(units[newValue]);
        }

        this.unitConverter = (value) => {
            // App default satoshi
            const appDefaultUnit = "satoshi";
            let convertedValueFn;
            if (this.state.unit.conversionName !== "fiat") {
                convertedValueFn = btcConvert(value, appDefaultUnit).to(this.state.unit.conversionName);
                return {
                    value: convertedValueFn.value(),
                    string: convertedValueFn.format(),
                    unit: convertedValueFn._unit,
                    nonSciString: `${convertedValueFn.value().toFixed(this.state.unit.conversionName === 'btc' ? 8 : 0)} ${this.state.unit.symbol}`
                }
            }
            else {
                let btcValue = btcConvert(value, appDefaultUnit).to("btc");
                convertedValueFn = (btcValue * this.state.unit.multiplier).toFixed(2);
                return {
                    nonSciString: `${convertedValueFn} ${this.state.unit.symbol}`
                }
            }
        }

        // units[1] is BTC. See: `../StateManager/Contexts.js`
        this.state = {
            unit: units[1],
            cycleUnits: this.cycleUnits,
            changeUnit: this.changeUnit,
            unitConverter: this.unitConverter,
            loadUnit: this.loadUnit
        }
    }

    render() {
        return (
            <UnitContext.Provider value={this.state}>
                {this.props.children}
            </UnitContext.Provider>
        )
    }
}

export const UnitConsumer = UnitContext.Consumer;
export {
    UnitContext
}