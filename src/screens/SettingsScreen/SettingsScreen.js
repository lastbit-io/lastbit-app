import React, { Component } from 'react';
import {
  Text,
  View,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Linking,
  Image,
  Clipboard,
  BackHandler,
  Alert,
  TextInput,
  Platform,
  Modal,
  ActivityIndicator
} from 'react-native';
import Reactotron from 'reactotron-react-native';
import validator from 'validator';
import RNRestart from 'react-native-restart';
import Mixpanel from 'react-native-mixpanel';
import { Sentry } from 'react-native-sentry';
import AsyncStorage from '@react-native-community/async-storage';

import { ThemeConsumer } from 'theme-manager';
import { UnitConsumer } from 'unit-manager';
import ProvideCombinedContext, { CombinedContext } from 'state-manager';
import KeyManager from 'key-manager';
import bip32 from 'bip32';
import config from 'config';
import WalletManager from 'wallet-manager';
// import PINCode from '@haskkor/react-native-pincode';
import LanguageSelector from 'language-selector';
import * as Keychain from 'react-native-keychain';
import generateStyleSheet from './style';

// import {
//     Menu,
//     MenuOptions,
//     MenuOption,
//     MenuTrigger,
// } from 'react-native-popup-menu';
// import * as themes from '../../themes';
// import ColorThemeDynaIcon from '../../components/ColorThemeDynaIcon/ColorThemeDynaIcon';

let style = false;

class SettingsScreen extends Component {
  static contextType = CombinedContext;

  constructor(props) {
    super(props);
    this.state = {
      mnemonicPin: '',
      newPin1: '',
      newPin2: '',
      existingPin: '',
      pinVisible: false,
      feedbackText: '',
      feedbackEmail: '',
      enableBiometric:false,
      feedbackVisible: false,
      rescanModalVisible:false,
      settings: [
        {
          id: 0,
          key: 'submitFeedback',
        },
        // {
        //   id: 1,
        //   key: 'exportWallet',
        // },
        {
          id: 2,
          key: 'changeCurrency',
        },
        // {
        //   id: 3,
        //   key: 'language',
        // },
        {
          id: 4,
          key: 'backupMnemonicTitle',
        },
        {
          id: 5,
          key: 'changePIN',
        },
        {
          id: 6,
          key: 'wipeData',
        },
        {
          id: 7,
          key: 'Toggle Biometric Authentication',
        },
        {
          id: 8,
          key: 'aboutUs',
        },
        {
          id: 9,
          key: 'connectToBluetooth',
        },
        {
          id: 10,
          key: 'Rescan Complete Wallet',
        },
        {
          id: 11,
          key:'joinSlack'
        },
        {
          id: 12,
          key: 'appVersion',
          value: 'v0.1.4 (68)',
        },
      ],
    };
  }

  componentDidMount() {
    const { navigation } = this.props;

    this.startTrackTimer = this.props.navigation.addListener('didFocus', () =>
      Mixpanel.timeEvent('Settings Screen Tab')
    );

    this.endTrackTimer = this.props.navigation.addListener('didBlur', () =>
      Mixpanel.track('Settings Screen Tab')
    );

    window.EventBus.on('rescanWalletCompleted',()=>{
      this.setState({rescanModalVisible:false})
    })

    this.setState({
      settings: this.state.settings.map(setting => ({
        ...setting,
        key: this.context.translate(setting.key),
      })),
    });

    this.focusListener = navigation.addListener('didFocus', () => {
      // The screen is focused
      if (
        this.props.navigation.state.params &&
        this.props.navigation.state.params.executeSetting == 'backup'
      )
        this.executeSettingAction({ id: 4 });
    });
  }

  componentWillUnmount() {
    this.startTrackTimer && this.startTrackTimer.remove();
    this.endTrackTimer && this.endTrackTimer.remove();
    window.EventBus.off('rescanWalletCompleted',()=>{
      this.setState({rescanModalVisible:false})
    })
  }

  submitFeedback = async () => {
    if (this.state.feedbackText.length <= 0) {
      Mixpanel.track(`Settings Screen Error: No feedback entered`);
      window.EventBus.trigger('showDropdownAlert', {
        type: 'error',
        title: 'No feedback entered',
        message: 'Please enter some feedback before submitting.',
      });
      return;
    }

    if (this.state.feedbackText.length <= 0) {
      Mixpanel.track(`Settings Screen Error: No feedback entered`);
      window.EventBus.trigger('showDropdownAlert', {
        type: 'error',
        title: 'No feedback entered',
        message: 'Please enter some feedback before submitting.',
      });
      return;
    }
    if (!validator.isEmail(this.state.feedbackEmail)) {
      Mixpanel.track(`Settings Screen Error: Invalid Email Address`);
      window.EventBus.trigger('showDropdownAlert', {
        type: 'error',
        title: 'Invalid Email Address',
        message: 'Please double check the email address that you have entered.',
      });
      return;
    }

    this.setState({ feedbackVisible: false });

    try {
      const currentWalletIndex = await WalletManager.getCurrentGeneratedAddressIndex();
      const xpub = (xpubKey = KeyManager.getXpub());

      const response = await fetch(config.feedbackLink, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          clientEmail: this.state.feedbackEmail,
          feedback: this.state.feedbackText,
          logs: JSON.stringify({
            currentWalletIndex,
            xpub,
          }),
        }),
      });
      Mixpanel.track('Settings Confirm Feedback Submited');
      window.EventBus.trigger('showDropdownAlert', {
        type: 'success',
        title: 'Feedback submitted',
        message: 'Thank you!',
      });
    } catch (error) {
      Sentry.captureException(error);
      window.EventBus.trigger('showDropdownAlert', {
        type: 'error',
        title: 'Something went wrong',
        message: 'Please try again later.',
      });
    }

    this.setState({
      feedbackEmail: '',
      feedbackText: '',
    });
  };

  exportMnemonic = async () => {
    const response = await KeyManager.getMnemonic(this.state.mnemonicPin);
    this.setState({
      pinVisible: false,
      mnemonicPin: '',
      exportMnemonic: false,
    });
    if (response.success === true) {
      Mixpanel.track('Settings Confirm Export Mnemonic');
      this.props.handleSwipeGesture(true);
      this.props.navigation.navigate('BackupScreen', {
        mnemonic: response.mnemonic.split(' '),
      });
    } else {
      Mixpanel.track(`Settings Screen Error: Incorrect PIN`);
      window.EventBus.trigger('showDropdownAlert', {
        type: 'error',
        title: this.context.translate('errWrongPin'),
        message: this.context.translate('plsTryAgain'),
      });
    }
  };

  toggleBiometric = async()=>{
    const verificationResponse = await KeyManager.checkPin(
      this.state.mnemonicPin
    );

    if(verificationResponse.success == false){
      window.EventBus.trigger('showDropdownAlert', {
        type: 'error',
        title: this.context.translate('errWrongPin'),
        message: this.context.translate('plsTryAgain'),
      });
      this.setState({enableBiometric:false, mnemonicPin:'', pinVisible:false})
      return
    }
    
    let useBiometrics = await AsyncStorage.getItem('useBiometrics')

    if(useBiometrics){
      Alert.alert('Disable Biometric Auth?', 'You can reenable this feature later.',[
        {
          text:'Disable',
          style:'destructive',
          onPress:async ()=>{
            await Keychain.resetGenericPassword()
            await AsyncStorage.removeItem('useBiometrics')
            this.setState({enableBiometric:false, mnemonicPin:'', pinVisible:false})
          }
        },{
          text:'Cancel',
          onPress:()=>{
            this.setState({enableBiometric:false, mnemonicPin:'', pinVisible:false})
          }
        }
      ])
    }else{
      Alert.alert('Enable Biometric Auth?', 'You can disable this feature later.',[
        {
          text:'Enable',
          style:'destructive',
          onPress:async ()=>{
            await AsyncStorage.setItem('useBiometrics','true')
            await Keychain.setGenericPassword('lastbituser',this.state.mnemonicPin, {accessControl:Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET})
            await Keychain.getGenericPassword()
            this.setState({enableBiometric:false, mnemonicPin:'', pinVisible:false})
          }
        },{
          text:'Cancel',
          onPress:()=>{
            this.setState({enableBiometric:false, mnemonicPin:'', pinVisible:false})
          }
        }
      ])
    }
  }

  exportWIF = async mnemonicPin => {
    const verificationResponse = await KeyManager.checkPin(mnemonicPin);
    this.setState({ pinVisible: false, exportWIF: false });
    if (verificationResponse.success === false) {
      Mixpanel.track(`Settings Screen Error: Incorrect PIN`);
      window.EventBus.trigger('showDropdownAlert', {
        type: 'error',
        title: this.context.translate('errWrongPin'),
        message: this.context.translate('plsTryAgain'),
      });
      return;
    }

    const privKey = KeyManager.getXpriv();
    const wifFormat = bip32.fromBase58(privKey, config.bitcoinNetwork).toWIF();
    Clipboard.setString(wifFormat);
    Mixpanel.trackWithProperties('Settings Confirm Export WIF');
    this.props.handleSwipeGesture(true);
    window.EventBus.trigger('showDropdownAlert', {
      type: 'success',
      title: this.context.translate('successExportTitle'),
      message: this.context.translate('successWifExport'),
    });
  };

  wipeData = async () => {
    const { translate } = this.context;
    const verificationResponse = await KeyManager.checkPin(
      this.state.mnemonicPin
    );
    this.setState({ pinVisible: false, mnemonicPin: '', wipeData: false });
    if (verificationResponse.success === false) {
      Mixpanel.track(`Settings Screen Error: Incorrect Pin`);
      window.EventBus.trigger('showDropdownAlert', {
        type: 'error',
        title: translate('errWrongPin'),
        message: translate('plsTryAgain'),
      });
      return;
    }
    Alert.alert(translate('warning'), translate('wipeWarning'), [
      {
        text: translate('cancel'),
        style: 'cancel',
        onPress: () => {},
      },
      {
        text: translate('confirm'),
        onPress: () => {
          Mixpanel.track('Settings Wipe Data');
          AsyncStorage.clear();
          RNRestart.Restart();
        },
      },
    ]);
  };

  toggleCashierMode = async () => {
    await AsyncStorage.setItem('cashierMode', JSON.stringify(true));
    RNRestart.Restart();
  };

  changePin = async () => {
    const { translate } = this.context;
    if (this.state.newPin1.length !== 4 || this.state.newPin2.length !== 4) {
      Mixpanel.track(`Settings Screen Error: Please enter a 4 digit PIN`);
      window.EventBus.trigger('showDropdownAlert', {
        type: 'error',
        title: translate('invalidInput'),
        message: translate('errInvalidPinMsg'),
      });
      return;
    }

    if (this.state.newPin1 !== this.state.newPin2) {
      Mixpanel.track(`Settings Screen Error: PIN codes don't match`);
      window.EventBus.trigger('showDropdownAlert', {
        type: 'error',
        title: translate('errPinMismatchTitle'),
        message: translate('plsTryAgain'),
      });
      this.setState({ newPin1: '', newPin2: '', existingPin: '' });
      return;
    }

    if (this.state.existingPin == this.state.newPin2) {
      Mixpanel.track(
        `Settings Screen Error: Cannot set new PIN to existing PIN`
      );
      window.EventBus.trigger('showDropdownAlert', {
        type: 'error',
        title: translate('errSamePinTitle'),
        message: translate('errSamePinMsg'),
      });
      this.setState({ newPin1: '', newPin2: '', existingPin: '' });
      return;
    }

    const response = await KeyManager.changePin(
      this.state.existingPin,
      this.state.newPin1
    );
    if (response.success === false) {
      Mixpanel.track(`Settings Screen Error: Wrong Pin`);
      window.EventBus.trigger('showDropdownAlert', {
        type: 'error',
        title: translate('errWrongPin'),
        message: translate('plsTryAgain'),
      });
      this.setState({ newPin1: '', newPin2: '', existingPin: '' });
    } else {
      this.props.handleSwipeGesture(true);
      Mixpanel.trackWithProperties('Settings Confirm Pin Change', {
        message: translate('successPinChangeMsg'),
      });
      window.EventBus.trigger('showDropdownAlert', {
        type: 'success',
        title: translate('successPinChangeTitle'),
        message: translate('successPinChangeMsg'),
      });
      this.setState({
        pinChangeVisible: false,
        newPin1: '',
        newPin2: '',
        existingPin: '',
      });
    }
  };

  renderHeader = () => (
    <View style={{ backgroundColor: 'white' }}>
      <Text style={style.deviceTitleText}>
        {this.context.translate('settings')}
      </Text>
    </View>
  );

  executeSettingAction = async setting => {
    switch (setting.id) {
      case 0:
        Mixpanel.track('Settings Submit Feedback Pressed');
        this.props.handleSwipeGesture(false);
        this.setState({ feedbackVisible: true });
        break;
      case 1:
        Mixpanel.track('Settings Export Wallet Pressed');
        this.props.handleSwipeGesture(false);
        this.setState({
          pinVisible: true,
          exportWIF: true,
          exportMnemonic: false,
          wipeData: false,
        });
        break;
      case 2:
        await this.context.cycleUnits();
        Mixpanel.trackWithProperties('Settings Change Currency Pressed', {
          currency: this.context.coinUnitObj.unit.displayName,
        });
        break;
      case 4:
        Mixpanel.track('Settings Backup Wallet Pressed');
        this.props.handleSwipeGesture(false);
        this.setState({
          pinVisible: true,
          exportWIF: false,
          exportMnemonic: true,
          wipeData: false,
        });
        break;
      case 5:
        Mixpanel.track('Settings Change Pin Pressed');
        this.props.handleSwipeGesture(false);
        this.setState({ pinChangeVisible: true });
        break;
      case 6:
        Mixpanel.track('Settings Wipe Data Pressed');
        this.props.handleSwipeGesture(false);
        this.setState({
          pinVisible: true,
          exportWIF: false,
          exportMnemonic: false,
          wipeData: true,
        });
        break;
      case 7:
        supported = await Keychain.getSupportedBiometryType()
        if(Platform.OS != 'ios' || supported == null){
          Alert.alert('Biometric unsupported', 'Biometric authentication is only currently supported on iOS. It will soon be available on other platforms.')
          return
        }
        this.setState({
          pinVisible: true,
          exportWIF: false,
          exportMnemonic: false,
          wipeData: false,
          enableBiometric:true
        });
        break;
      case 8:
        Mixpanel.track('Settings About Us Pressed');
        Linking.openURL('https://lastbit.io');
        break;
      case 9:
        // this.props.navigation.navigate('PairScreen');
        window.EventBus.trigger('showDropdownAlert', {
          type: 'success',
          title: this.context.translate('comingSoonTitle'),
          message: this.context.translate('comingSoonMsg'),
        });
        break;
      case 10:
        Alert.alert('Rescan Wallet?','This will temporarily erase all your transactions as we rebuild your wallet.',[
          {
            text:'Confirm',
            style:'destructive',
            onPress: async()=>{
              this.setState({rescanModalVisible:true})
              setTimeout(async () => {
                await AsyncStorage.removeItem('wallet')
                await WalletManager.getCurrentGeneratedAddressIndex()
                window.EventBus.trigger('walletRescanRequested')
              }, 0);
            }
          },
          {
            text:'Cancel'
          }
        ])
        break;
        case 11:
          Linking.openURL('https://join.slack.com/t/lastbitcommunity/shared_invite/enQtNzU5MjA1Nzk0MDE5LTBmY2ZhZTkxN2JlNGQzMDUzMjZkYWY5NGY2ZjI2ZjgxNjc0YjZhZjY0MDdhNDRiMjczMjk5OTU0MzhhN2FhNTI')
          break
      default:
    }
  };

  renderLangPicker = () => {
    const { translate } = this.context;
    return (
      <View style={{ flexDirection: 'row' }}>
        <Text style={{ ...style.subtitleText, marginTop: 10, marginRight: 15 }}>
          {translate('language')}
        </Text>
        <View
          style={{
            height: 45,
            width: 135,
            backgroundColor: '#efefef',
            borderWidth: 1,
            borderRadius: 25,
            borderColor: '#dedede',
            justifyContent: 'center',
          }}
        >
          <LanguageSelector />
        </View>
      </View>
    );
  };

  renderSettingsRow = (themeObj, item) => {
    const setting = item.item;
    return (
      <UnitConsumer>
        {coinUnitObj => (
          <TouchableOpacity
            style={{
              justifyContent: 'space-between',
              padding: 20,
              paddingHorizontal: 20,
              flexDirection: 'row',
              borderBottomColor: themeObj.theme.PRIMARY_LIST_SEPARATOR_COLOR,
              borderBottomWidth: 1,
              backgroundColor: themeObj.theme.SECONDARY_BACKGROUND_COLOR,
            }}
            // key={item.id + item.type}
            onPress={() => this.executeSettingAction(setting)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View>
                <Text style={style.settingsTitleText}>{setting.key}</Text>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
              {setting.id == 2 ? (
                <Text style={style.settingsTitleText}>
                  {coinUnitObj.unit.displayName}
                </Text>
              ) : setting.id == 3 ? (
                this.renderLangPicker()
              ) : (
                <Text style={style.settingsTitleText}>{setting.value}</Text>
              )}
            </View>
          </TouchableOpacity>
        )}
      </UnitConsumer>
    );
  };

  renderThemeSelect = () => {
    // {
    /* <Menu>
                    <MenuTrigger>
                        <Image style={style.themesImage} source={require('../../../assets/images/themesImage.png')} />
                    </MenuTrigger>
                    <MenuOptions customStyles={{ optionsContainer: { marginRight: 80, marginTop: 30, height: 160, width: 140 }, optionWrapper: { flex: 1, alignItems: 'flex-start', justifyContent: 'center', paddingVertical: 20 } }}>
                        <MenuOption disabled={true} text='Themes' customStyles={{ optionWrapper: { borderBottomColor: gray, backgroundColor: "#444" } }} />
                        <MenuOption onSelect={() => changeTheme(themes.yinyang)}>
                            <ColorThemeDynaIcon theme={themes.yinyang} />
                            <Text style={{ paddingLeft: 40 }}>Yin Yang</Text>
                        </MenuOption>
                        <MenuOption onSelect={() => changeTheme(themes.modern)}>
                            <ColorThemeDynaIcon theme={themes.modern} />
                            <Text style={{ paddingLeft: 40 }}>Modern</Text>
                        </MenuOption>
                        <MenuOption onSelect={() => changeTheme(themes.bitcoin)}>
                            <ColorThemeDynaIcon theme={themes.bitcoin} />
                            <Text style={{ paddingLeft: 40 }}>Shitcoin</Text>
                        </MenuOption>
                    </MenuOptions>
                </Menu> */
    // }
  };

  render() {
    const { translate } = this.context;
    return (
      <ThemeConsumer>
        {themeObj => {
          Reactotron.log('settings', themeObj);
          if (!style || themeObj.themeChanged) {
            style = themeObj.createStyle(generateStyleSheet, 'Settings Screen');
          }
          return (
            <View style={style.containerView}>
              <Modal visible={this.state.rescanModalVisible} animationType='fade'  onRequestClose={()=>{}}>
                <View style={{flex:1, backgroundColor:'white', alignItems:'center', justifyContent:'center'}}>
                  <ActivityIndicator/>
                  <Text style={{marginTop:20, fontFamily:'Quicksand-Medium', color:'black', fontSize:15, textAlign:'center'}}>Rebuilding your wallet</Text>
                  <Text style={{marginTop:10, fontFamily:'Quicksand-Medium', color:'black', fontSize:12, marginHorizontal:20, textAlign:'center'}}>Please do not close the app until this process is complete. This may take several minutes.</Text>
                </View>
              </Modal>
              <SafeAreaView style={style.safeAreaContainer}>
                <View style={style.headerContentContainer}>
                  {this.renderHeader()}
                </View>
                <View style={{ flex: 1 }}>
                  <FlatList
                    style={{ flex: 1 }}
                    data={this.state.settings}
                    extraData={this.state}
                    renderItem={item => this.renderSettingsRow(themeObj, item)}
                  />
                </View>
              </SafeAreaView>
              {this.state.pinVisible && (
                <View
                  style={{
                    position: 'absolute',
                    height: '100%',
                    width: '100%',
                    backgroundColor: 'rgba(0,0,0,0.8)',
                  }}
                >
                  <View style={{ backgroundColor: 'white', width: '100%' }}>
                    <SafeAreaView>
                      <View
                        style={{
                          backgroundColor: 'white',
                          padding: 20,
                          width: '100%',
                        }}
                      >
                        <TextInput
                          placeholder={translate('enterPinPlaceholder')}
                          secureTextEntry
                          autoFocus
                          keyboardType="number-pad"
                          value={this.state.mnemonicPin}
                          onChangeText={text =>
                            this.setState({
                              mnemonicPin: text.trim().slice(0, 4),
                            })
                          }
                          style={{
                            fontFamily: 'Quicksand-Medium',
                            color: 'black',
                            fontSize: 20,
                            textAlign: 'center',
                            padding: 10,
                            width: '100%',
                            borderBottomColor: 'black',
                            borderBottomWidth: 1,
                          }}
                        />
                        <View
                          style={{
                            width: '100%',
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            marginTop: 30,
                          }}
                        >
                          <TouchableOpacity
                            style={{ flex: 1, alignItems: 'center' }}
                            onPress={() => {
                              this.props.handleSwipeGesture(true);
                              this.setState({
                                pinVisible: false,
                                mnemonicPin: '',
                              });
                            }}
                          >
                            <Text style={themeObj.theme.BTN_WARNING}>
                              {translate('cancel')}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={{ flex: 1, alignItems: 'center' }}
                            onPress={() => {
                              if (this.state.exportMnemonic)
                                this.exportMnemonic().done();
                              else if (this.state.exportWIF)
                                this.exportWIF().done();
                              else if (this.state.wipeData)
                                this.wipeData().done();
                              else if (this.state.enableBiometric)
                                this.toggleBiometric().done()
                            }}
                          >
                            <Text style={themeObj.theme.BTN_PRIMARY}>
                              {translate('confirm')}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </SafeAreaView>
                  </View>
                </View>
              )}
              {this.state.pinChangeVisible && (
                <View
                  style={{
                    position: 'absolute',
                    height: '100%',
                    width: '100%',
                    backgroundColor: 'rgba(0,0,0,0.8)',
                  }}
                >
                  <View style={{ backgroundColor: 'white', width: '100%' }}>
                    <SafeAreaView>
                      <View
                        style={{
                          backgroundColor: 'white',
                          padding: 20,
                          width: '100%',
                        }}
                      >
                        <TextInput
                          placeholder={translate('enterExistingPin')}
                          secureTextEntry
                          autoFocus
                          keyboardType="number-pad"
                          value={this.state.existingPin}
                          onChangeText={text =>
                            this.setState({
                              existingPin: text.trim().slice(0, 4),
                            })
                          }
                          style={{
                            fontFamily: 'Quicksand-Medium',
                            color: 'black',
                            fontSize: 20,
                            padding: 10,
                            width: '100%',
                            borderBottomColor: 'black',
                            borderBottomWidth: 1,
                          }}
                        />
                        <TextInput
                          placeholder={translate('enterNewPin')}
                          secureTextEntry
                          keyboardType="number-pad"
                          value={this.state.newPin1}
                          onChangeText={text =>
                            this.setState({ newPin1: text.trim().slice(0, 4) })
                          }
                          style={{
                            fontFamily: 'Quicksand-Medium',
                            color: 'black',
                            fontSize: 20,
                            padding: 10,
                            width: '100%',
                            borderBottomColor: 'black',
                            borderBottomWidth: 1,
                          }}
                        />
                        <TextInput
                          placeholder={translate('repeatNewPin')}
                          secureTextEntry
                          keyboardType="number-pad"
                          value={this.state.newPin2}
                          onChangeText={text =>
                            this.setState({ newPin2: text.trim().slice(0, 4) })
                          }
                          style={{
                            fontFamily: 'Quicksand-Medium',
                            color: 'black',
                            fontSize: 20,
                            padding: 10,
                            width: '100%',
                            borderBottomColor: 'black',
                            borderBottomWidth: 1,
                          }}
                        />
                        <View
                          style={{
                            width: '100%',
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            marginTop: 30,
                          }}
                        >
                          <TouchableOpacity
                            style={{ flex: 1, alignItems: 'center' }}
                            onPress={() => {
                              this.props.handleSwipeGesture(true);
                              this.setState({
                                pinChangeVisible: false,
                                newPin1: '',
                                newPin2: '',
                                existingPin: '',
                              });
                            }}
                          >
                            <Text style={themeObj.theme.BTN_WARNING}>
                              {translate('cancel')}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={{ flex: 1, alignItems: 'center' }}
                            onPress={() => {
                              this.changePin().done();
                            }}
                          >
                            <Text style={themeObj.theme.BTN_PRIMARY}>
                              {translate('confirm')}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </SafeAreaView>
                  </View>
                </View>
              )}

              {this.state.feedbackVisible && (
                <View
                  style={{
                    position: 'absolute',
                    height: '100%',
                    width: '100%',
                    backgroundColor: 'rgba(0,0,0,0.8)',
                  }}
                >
                  <View style={{ backgroundColor: 'white', width: '100%' }}>
                    <SafeAreaView>
                      <View
                        style={{
                          backgroundColor: 'white',
                          padding: 20,
                          width: '100%',
                        }}
                      >
                        <TextInput
                          placeholder={translate('feedbackEmailPlaceholder')}
                          autoFocus
                          keyboardType="email-address"
                          value={this.state.feedbackEmail}
                          onChangeText={text =>
                            this.setState({ feedbackEmail: text })
                          }
                          style={{
                            fontFamily: 'Quicksand-Medium',
                            color: 'black',
                            fontSize: 20,
                            padding: 10,
                            width: '100%',
                            borderBottomColor: 'black',
                            borderBottomWidth: 1,
                          }}
                        />
                        <TextInput
                          placeholder={translate('feedbackTextPlaceholder')}
                          value={this.state.feedbackText}
                          onChangeText={text =>
                            this.setState({ feedbackText: text })
                          }
                          multiline
                          style={{
                            fontFamily: 'Quicksand-Medium',
                            color: 'black',
                            marginTop: 20,
                            fontSize: 20,
                            padding: 10,
                            width: '100%',
                            borderBottomColor: 'black',
                            borderBottomWidth: 1,
                          }}
                        />
                        <View
                          style={{
                            width: '100%',
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            marginTop: 30,
                          }}
                        >
                          <TouchableOpacity
                            style={{ flex: 1, alignItems: 'center' }}
                            onPress={() => {
                              this.props.handleSwipeGesture(true);
                              this.setState({ feedbackVisible: false });
                            }}
                          >
                            <Text style={themeObj.theme.BTN_WARNING}>
                              {translate('cancel')}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={{ flex: 1, alignItems: 'center' }}
                            onPress={() => {
                              this.props.handleSwipeGesture(true);
                              this.submitFeedback().done();
                            }}
                          >
                            <Text style={themeObj.theme.BTN_PRIMARY}>
                              {translate('submit')}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </SafeAreaView>
                  </View>
                </View>
              )}
              {this.state.feedbackVisible && (
                <View
                  style={{
                    position: 'absolute',
                    height: '100%',
                    width: '100%',
                    backgroundColor: 'rgba(0,0,0,0.8)',
                  }}
                >
                  <View style={{ backgroundColor: 'white', width: '100%' }}>
                    <SafeAreaView>
                      <View
                        style={{
                          backgroundColor: 'white',
                          padding: 20,
                          width: '100%',
                        }}
                      >
                        <TextInput
                          placeholder={translate('feedbackEmailPlaceholder')}
                          autoFocus
                          keyboardType="email-address"
                          value={this.state.feedbackEmail}
                          onChangeText={text =>
                            this.setState({ feedbackEmail: text })
                          }
                          style={{
                            fontFamily: 'Quicksand-Medium',
                            color: 'black',
                            fontSize: 20,
                            padding: 10,
                            width: '100%',
                            borderBottomColor: 'black',
                            borderBottomWidth: 1,
                          }}
                        />
                        <TextInput
                          placeholder={translate('feedbackTextPlaceholder')}
                          value={this.state.feedbackText}
                          onChangeText={text =>
                            this.setState({ feedbackText: text })
                          }
                          multiline
                          style={{
                            fontFamily: 'Quicksand-Medium',
                            color: 'black',
                            marginTop: 20,
                            fontSize: 20,
                            padding: 10,
                            width: '100%',
                            borderBottomColor: 'black',
                            borderBottomWidth: 1,
                          }}
                        />
                        <View
                          style={{
                            width: '100%',
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            marginTop: 30,
                          }}
                        >
                          <TouchableOpacity
                            style={{ flex: 1, alignItems: 'center' }}
                            onPress={() => {
                              this.props.handleSwipeGesture(true);
                              this.setState({ feedbackVisible: false });
                            }}
                          >
                            <Text style={themeObj.theme.BTN_WARNING}>
                              {translate('cancel')}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={{ flex: 1, alignItems: 'center' }}
                            onPress={() => {
                              this.props.handleSwipeGesture(true);
                              this.submitFeedback().done();
                            }}
                          >
                            <Text style={themeObj.theme.BTN_PRIMARY}>
                              {translate('submit')}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </SafeAreaView>
                  </View>
                </View>
              )}
            </View>
          );
        }}
      </ThemeConsumer>
    );
  }
}

export default class ContextWrappedComponent extends Component {
  static navigationOptions = ({ navigation }) => {
    const { params } = navigation.state;

    return {
      swipeEnabled: params ? params.swipeEnabled : true,
    };
  };

  handleSwipeGesture = isSwipeable => {
    this.props.navigation.setParams({ swipeEnabled: isSwipeable });
  };

  render() {
    return (
      <ProvideCombinedContext>
        <SettingsScreen
          {...this.props}
          handleSwipeGesture={this.handleSwipeGesture}
        />
      </ProvideCombinedContext>
    );
  }
}
