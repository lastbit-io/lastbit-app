import React, { Component } from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  AsyncStorage,
  Alert,
  Platform,
  Switch,
  ActivityIndicator,
  Keyboard
} from 'react-native';
import Mixpanel from 'react-native-mixpanel';
import * as Keychain from 'react-native-keychain';

import KeyManager from 'key-manager';
import RNRestart from 'react-native-restart';
import ProvideCombinedContext, { CombinedContext } from 'state-manager';
import style from './style';

class CreatePINComponent extends Component {
  static contextType = CombinedContext;

  constructor(props) {
    super(props);
    this.state = {
      pinField1: '',
      pinField2: '',
      loading:false,
      biometricSupported:false
    };
  }

  componentDidMount(){
    this.checkBiometricSupport().done()
  }

  checkBiometricSupport = async ()=>{
    supported = await Keychain.getSupportedBiometryType()
    if(supported !== null && Platform.OS == 'ios'){
      this.setState({biometricSupported:true})
    }
  }

  savedNewPin = async () => {
    const { mixpanelText } = this.props;
    if (
      this.state.pinField1.length > 0 &&
      this.state.pinField2.length > 0 &&
      this.state.pinField1 === this.state.pinField2
    ) {
      this.setState({loading:true},async ()=>{
        setTimeout(async () => {
          await KeyManager.saveMnemonic(
            this.props.mnemonic,
            this.state.pinField1,
            this.props.passphrase
          );  
          try {
            supported = await Keychain.getSupportedBiometryType()
            if(supported !== null && Platform.OS == 'ios' && this.state.biometricSupported == true){
              await AsyncStorage.setItem('useBiometrics','true')
              await Keychain.setGenericPassword('lastbituser',this.state.pinField1, {accessControl:Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET})
              await Keychain.getGenericPassword()
              Mixpanel.trackWithProperties(`${mixpanelText} Pin Confirm Success`, {
                button_text: 'Confirm',
              });
              RNRestart.Restart();
            }else{
              Mixpanel.trackWithProperties(`${mixpanelText} Pin Confirm Success`, {
                button_text: 'Confirm',
              });
              RNRestart.Restart();
            }
          } catch (error) {
            Mixpanel.trackWithProperties(`${mixpanelText} Pin Confirm Success`, {
              button_text: 'Confirm',
            });
            alert(error)
            RNRestart.Restart();
          }
        }, 50);
      })
    } else {
      Mixpanel.track(`Create PIN Error: PIN codes don't match`);
      window.EventBus.trigger('showDropdownAlert', {
        type: 'error',
        title: this.context.translate('errPinMismatchTitle'),
        message: this.context.translate('plsTryAgain'),
      });
    }
  };

  render() {
    const { translate, theme } = this.context;
    const { mixpanelText } = this.props;
    if(this.state.loading == true){
      return(
        <View
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0,0,0,0.7)',
          }}
        >
          <View style={{ backgroundColor: 'white' }}>
            <SafeAreaView>
              <View style={{padding:20, alignItems:'center'}}>
                <ActivityIndicator/>
                <Text style={{
                  fontFamily: 'Quicksand-Regular',
                  fontSize: 12,
                  marginTop: 10,
                }}>Setting up wallet</Text>
              </View>
            </SafeAreaView>
          </View>
        </View>
      )
    }
    return (
      <View
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0,0,0,0.7)',
        }}
      >
        <View style={{ backgroundColor: 'white' }}>
          <SafeAreaView>
            <View style={{ padding: 20 }}>
              <Text style={{ ...style.mneminicWordText, fontSize: 15 }}>
                {translate('enterPinTitle')}
              </Text>
              <Text
                style={{
                  width: '100%',
                  fontFamily: 'Quicksand-Regular',
                  fontSize: 12,
                  marginTop: 10,
                }}
              >
                {translate('enterPinText')}
              </Text>
              <View
                style={{
                  marginVertical: 10,
                  marginTop: 30,
                  width: '100%',
                  borderBottomColor: 'black',
                  borderBottomWidth: 1,
                }}
              >
                <TextInput
                  style={{ ...style.textInput, padding: 5, fontSize: 15 }}
                  placeholder={translate('enterPinPlaceholder')}
                  keyboardType="number-pad"
                  allowFontScaling={false}
                  value={this.state.pinField1}
                  onChangeText={text =>
                    this.setState({ pinField1: text.trim().slice(0, 4) })
                  }
                  returnKeyType='next'
                  onSubmitEditing={()=>{
                    this.textinput2.focus()
                  }}
                  secureTextEntry
                  autoFocus
                />
              </View>
              <View
                style={{
                  marginVertical: 10,
                  width: '100%',
                  borderBottomColor: 'black',
                  borderBottomWidth: 1,
                }}
              >
                <TextInput
                  ref={field => this.textinput2 = field}
                  keyboardType="number-pad"
                  value={this.state.pinField2}
                  allowFontScaling={false}
                  returnKeyType='done'
                  style={{ ...style.textInput, padding: 5, fontSize: 15 }}
                  placeholder={translate('repeatPinPlaceholder')}
                  onChangeText={text => {
                    this.setState({ pinField2: text.trim().slice(0, 4) });
                  }}
                  onSubmitEditing={Keyboard.dismiss}
                  secureTextEntry
                />
              </View>
            </View>
            {
              Platform.OS == 'ios' &&
              <View style={{padding:20, flexDirection:'row', alignItems:'center'}}>
                <Switch value={this.state.biometricSupported} onValueChange={value=>this.setState({biometricSupported:value})}/>
                <Text style={{marginLeft:20, fontSize:12, fontFamily: 'Quicksand-Regular'}}>Unlock with Biometrics</Text>
              </View>
            }
            <View
              style={{ marginBottom: 20, width: '100%', flexDirection: 'row' }}
            >
              <TouchableOpacity
                style={{ flex: 1, alignItems: 'center' }}
                onPress={() => {
                  Mixpanel.trackWithProperties(`${mixpanelText} Pin Cancel`, {
                    button_text: 'Cancel',
                  });
                  this.props.onClose();
                }}
              >
                <Text style={theme.BTN_WARNING}>{translate('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, alignItems: 'center' }}
                onPress={() => this.savedNewPin()}
              >
                <Text style={theme.BTN_PRIMARY}>{translate('confirm')}</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </View>
    );
  }
}

const ContextWrappedComponent = props => (
  <ProvideCombinedContext>
    <CreatePINComponent {...props} />
  </ProvideCombinedContext>
);

export default ContextWrappedComponent;
