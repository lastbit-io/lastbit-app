import React, { Component } from 'react';
import { Text, View, SafeAreaView, Image, Button } from 'react-native';
import style from './style'
import { BLEProvider, BLEConsumer } from '../../managers/BLEManager'
// import { BLEContext } from '../../managers/StateManager/Contexts';
import Reactotron from 'reactotron-react-native';
var bluetoothGif = require('../../../assets/images/bluetooth.gif')

export default class PairScreen extends Component {
    constructor(props) {
        super(props)
    }

    componentDidMount() {

    }

    render() {
        return (
            <View style={{ flex: 1 }}>
                <BLEProvider>
                    <SafeAreaView style={style.safeAreaContainer}>
                        <Text style={style.titleText}>lastbit Go</Text>
                        <BLEConsumer>{bleObj =>
                            <Text style={style.subTitleText}>{!bleObj.connected ? 'Attempting to connect...' : 'Connected!'}</Text>
                        }
                        </BLEConsumer>
                        <View style={style.animationContainerView}>
                            <Image style={style.animationImage} source={bluetoothGif} />
                            {/* <BLEConsumer>{bleObj => {
                            !bleObj.connected ?
                                <Image style={style.animationImage} source={bluetoothGif} />
                                :
                                <Icon name={'ios-checkmark-circle-outline'} tint='green' size={40} />
                        }}
                        </BLEConsumer> */}
                        </View>
                        <BLEConsumer>{bleObj => <Text style={style.issuesText}>{!bleObj.connected ? 'Double check that your device is discoverable' : 'You can now securely sign transactions with your GO!'}</Text>}</BLEConsumer>
                        <Button style={{ marginBottom: 20 }} title={'Go Back'} onPress={() => this.props.navigation.navigate('HomeScreen')} />
                    </SafeAreaView>
                </BLEProvider>
            </View>
        );
    }
}