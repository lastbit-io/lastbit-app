import React, { Component } from 'react'
import {
    View,
    Image,
    Text,
    TouchableOpacity
} from 'react-native'
import generateStyleSheet from './style'
import moment from 'moment'
import { ThemeConsumer } from 'theme-manager'
import { UnitConsumer } from 'unit-manager';
import ProvideCombinedContext, { CombinedContext } from 'state-manager';

let receive = require('../../../assets/images/bottom_left_arrow.png');
let refresh = require('../../../assets/images/refresh.png')
let send = require('../../../assets/images/top_right_arrow.png');
let deposit = require('../../../assets/images/bitcoin_piggy_in.png');
let withdraw = require('../../../assets/images/bitcoin_piggy_out.png');

var style = false;

class TransactionRowView extends Component {
    static contextType = CombinedContext;
    constructor(props) {
        super(props);
    }

    render() {
        const { translate } = this.context;
        let variant = this.props.variant ? this.props.variant : 'bitcoin';
        let item = this.props.transaction;
        let index = this.props.index;
        let confirmationString = '';
        if (variant === 'bitcoin' || item.type == 'bitcoind_tx') {
            if (item.confirmations >= 6)
                confirmationString = translate('confirmed');
            else
                confirmationString = `${(item.confirmations?item.confirmations:'0')} ${translate('confs')}`;
        }
        else {
            confirmationString = item.status;
        }

        let amountSatoshis = Math.abs(item.amount);

        return (
            <ThemeConsumer>
                {themeObj => {
                    if (!style || themeObj.themeChanged) {
                        style = themeObj.createStyle(generateStyleSheet, "Transaction Row View");
                    }
                    return (
                        <TouchableOpacity style={{
                            ...style.transactionContainer,
                            backgroundColor: item.confirmations === 0 ? themeObj.theme.MUTED_COLOR : themeObj.theme.SECONDARY_BACKGROUND_COLOR
                        }} key={item.id + item.type} onPress={() => this.props.onSelect(item)}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Image
                                    style={item.type === 'bitcoind_tx' ?
                                        item.category === 'deposit' ? style.boxDepositImage : style.boxWithdrawImage
                                        : item.type === 'receive' ? 
                                            style.boxReceiveImage : 
                                            item.type === 'self'?
                                            {...style.boxSendImage, tintColor:'white'}
                                            :
                                            style.boxSendImage}
                                    source={item.type === 'bitcoind_tx' ?
                                          item.category === 'deposit' ? deposit : withdraw
                                        : item.type === 'receive' ? receive : 
                                            item.type === 'self'?
                                            refresh
                                            :
                                            send}
                                />
                                <View>
                                    <Text style={style.transactionTimeText}>{item.time?moment.unix(item.time).format('MMM Do[,] YYYY HH[:]mm'):'Unconfirmed'}</Text>
                                    <Text extraData={item.confirmations} style={{ ...style.transactionTimeText, color: themeObj.theme.COLOR_STATUS }}>{confirmationString}</Text>
                                </View>
                            </View>
                            <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                                <UnitConsumer>
                                    {coinUnitObj =>
                                        <Text style={style.transactionTimeText}>{(item.type === 'bitcoind_tx' ?
                                            item.category === 'deposit' ? '+' : '-'
                                            : item.type === 'receive' ? '+' :
                                                item.type === 'self'? ''
                                                : '-') + coinUnitObj.unitConverter(amountSatoshis).nonSciString}</Text>
                                    }
                                </UnitConsumer>
                            </View>
                        </TouchableOpacity>
                    )
                }}
            </ThemeConsumer>
        )
    }
}

const ContextWrappedComponent = props => {
    return (
        <ProvideCombinedContext>
            <TransactionRowView {...props} />
        </ProvideCombinedContext>
    );
};

export default ContextWrappedComponent;
