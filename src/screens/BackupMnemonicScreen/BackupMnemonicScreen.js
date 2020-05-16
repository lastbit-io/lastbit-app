import React, { Component } from 'react';
import Icon from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  TextInput,
  Clipboard,
  BackHandler,
  ActivityIndicator,
  Image,
  Alert,
  Dimensions,
  Keyboard,
  Modal,
} from 'react-native';
// import PINCode from '@haskkor/react-native-pincode';
import AsyncStorage from '@react-native-community/async-storage';
import RNRestart from 'react-native-restart';
import KeyManager from 'key-manager';
import Mixpanel from 'react-native-mixpanel';
import CreatePINComponent from 'create-pin';
import ProvideCombinedContext, { CombinedContext } from 'state-manager';
import { Sentry } from 'react-native-sentry';
import Reactotron from 'reactotron-react-native';
import QRCode from 'react-native-qrcode-svg';
import DropdownAlert from 'react-native-dropdownalert';

import style from './style';

const { width, height } = Dimensions.get('window');

class BackupMnemonicScreen extends Component {
  static contextType = CombinedContext;

  constructor(props) {
    super(props);
    this.state = {
      mnemonic: [],
      contentMode: 'displayWords',
      quizWords: [],
      quizWord0: '',
      quizWord1: '',
      quizWord2: '',
      passphraseField1: '',
      passphraseField2: '',
      selectedPassphrase: '',
      optionalPassphraseVisible: false,
      init: false,
      pinVisible: false,
      dynamicHeight: height / 1.3,
      lastbitIdModalVisible: false,
    };
    this.backButton = props.navigation.addListener('didFocus', payload =>
      BackHandler.addEventListener('hardwareBackPress', this.exitBackupScreen)
    );

    this.keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      this.keyboardDidShow
    );
    this.keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      this.keyboardDidHide
    );
  }

  async componentDidMount() {
    let init = false;
    const response = await KeyManager.doKeysExist();
    Reactotron.log('BackupMnemonicScreen response', response);
    if (response.success === false) {
      init = true;
    }
    if (this.props.navigation.state.params.mnemonic)
      this.setState({
        mnemonic: this.props.navigation.state.params.mnemonic,
        init,
      });
    else this.props.navigation.navigate('WelcomeScreen');

    this.movedAwayFromBalance = this.props.navigation.addListener(
      'willBlur',
      payload =>
        BackHandler.removeEventListener(
          'hardwareBackPress',
          this.exitBackupScreen
        )
    );
  }

  componentWillUnmount() {
    Keyboard.removeListener('keyboardDidShow', this.keyboardDidShow);
    Keyboard.removeListener('keyboardDidHide', this.keyboardDidHide);
  }

  keyboardDidShow = e => {
    this.setState({
      dynamicHeight: height * 0.8 - e.endCoordinates.height,
    });
  };

  keyboardDidHide = () => {
    this.setState({
      dynamicHeight: height / 1.3,
    });
  };

  generateQuizWords = () => {
    let n1 = 0;
    let n2 = 0;
    let n3 = 0;
    while (n1 == n2 || n2 == n3 || n1 == n3) {
      n1 = Math.floor(Math.random() * 24);
      n2 = Math.floor(Math.random() * 24);
      n3 = Math.floor(Math.random() * 24);
    }
    this.setState({ quizWords: [n1, n2, n3] });
  };

  verifyQuizAndProceed = async () => {
    if (
      this.state.quizWord0.toLowerCase() ===
        this.state.mnemonic[this.state.quizWords[0]].toLowerCase() &&
      this.state.quizWord1.toLowerCase() ===
        this.state.mnemonic[this.state.quizWords[1]].toLowerCase() &&
      this.state.quizWord2.toLowerCase() ===
        this.state.mnemonic[this.state.quizWords[2]].toLowerCase()
    ) {
      await AsyncStorage.setItem('userBackedUpMnemonic', 'yes');
      if (this.state.init) {
        this.setState({ pinVisible: true });
      } else {
        this.props.navigation.navigate('HomeScreen');
      }
    } else {
      Mixpanel.track(`BackupMnemonic Error: Invalid input`);
      window.EventBus.trigger('showDropdownAlert', {
        type: 'error',
        title: this.context.translate('invalidInput'),
        message: this.context.translate('plsTryAgain'),
      });
    }
  };

  copyMnemonic = () => {
    Clipboard.setString(this.state.mnemonic.join(' '));
    if (this.dropdownAlert) {
      this.dropdownAlert.alertWithType(
        'info',
        this.context.translate('successExportTitle'),
        this.context.translate('successExportMsg')
      );
    } else {
      window.EventBus.trigger('showDropdownAlert', {
        type: 'info',
        title: this.context.translate('successExportTitle'),
        message: this.context.translate('successExportMsg'),
      });
    }
  };

  exitBackupScreen = () => {
    if (this.state.init) this.props.navigation.navigate('WelcomeScreen');
    else this.props.navigation.navigate('RootComponent');
    return true;
  };

  renderQuiz = () => {
    const { translate, theme } = this.context;
    const { dynamicHeight } = this.state;
    return (
      <View
        style={{
          height: dynamicHeight,
          width: '100%',
        }}
      >
        <ScrollView
          contentContainerStyle={{
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ alignItems: 'center' }}>
            <Text
              style={{
                fontSize: 15,
                margin: 15,
                marginTop: 40,
                textAlign: 'center',
                color: '#666666',
                fontFamily: 'Quicksand-Medium',
              }}
            >
              {translate('verifyMnemonicText')}
            </Text>
            <View style={{ paddingTop: 20, alignItems: 'center' }}>
              <View style={style.quizItemContainer}>
                <Text
                  style={{
                    ...style.mnemonicWordText,
                    width: 30,
                    textAlign: 'right',
                  }}
                >
                  {`${this.state.quizWords[0] + 1}. `}
                </Text>
                <View
                  style={{
                    borderBottomColor: 'black',
                    borderBottomWidth: 1,
                    paddingHorizontal: 5,
                    marginLeft: 10,
                  }}
                >
                  <TextInput
                    returnKeyType="done"
                    style={{
                      ...style.mnemonicWordText,
                      width: 200,
                      textAlign: 'center',
                    }}
                    placeholder={translate('verifyMnemonicTextboxPlaceholder')}
                    autoFocus
                    value={this.state.quizWord0}
                    autoCapitalize="none"
                    onChangeText={text =>
                      this.setState({ quizWord0: text.toLowerCase().trim() })
                    }
                  />
                </View>
              </View>
              <View style={style.quizItemContainer}>
                <Text
                  style={{
                    ...style.mnemonicWordText,
                    width: 30,
                    textAlign: 'right',
                  }}
                >
                  {`${this.state.quizWords[1] + 1}. `}
                </Text>
                <View
                  style={{
                    borderBottomColor: 'black',
                    borderBottomWidth: 1,
                    paddingHorizontal: 5,
                    marginLeft: 10,
                  }}
                >
                  <TextInput
                    returnKeyType="done"
                    style={{
                      ...style.mnemonicWordText,
                      width: 200,
                      textAlign: 'center',
                    }}
                    placeholder={translate('verifyMnemonicTextboxPlaceholder')}
                    autoCapitalize="none"
                    value={this.state.quizWord1}
                    onChangeText={text =>
                      this.setState({ quizWord1: text.toLowerCase().trim() })
                    }
                  />
                </View>
              </View>
              <View style={style.quizItemContainer}>
                <Text
                  style={{
                    ...style.mnemonicWordText,
                    width: 30,
                    textAlign: 'right',
                  }}
                >
                  {`${this.state.quizWords[2] + 1}. `}
                </Text>
                <View
                  style={{
                    borderBottomColor: 'black',
                    borderBottomWidth: 1,
                    paddingHorizontal: 5,
                    marginLeft: 10,
                  }}
                >
                  <TextInput
                    returnKeyType="done"
                    style={{
                      ...style.mnemonicWordText,
                      width: 200,
                      textAlign: 'center',
                    }}
                    placeholder={translate('verifyMnemonicTextboxPlaceholder')}
                    autoCapitalize="none"
                    value={this.state.quizWord2}
                    onChangeText={text =>
                      this.setState({ quizWord2: text.toLowerCase().trim() })
                    }
                  />
                </View>
              </View>
            </View>
          </View>
          <TouchableOpacity
            style={[theme.WIDE_BTN_CONTAINER, { marginVertical: 50 }]}
            onPress={() => {
              this.verifyQuizAndProceed();
            }}
          >
            <Text style={theme.BTN_PRIMARY}>{translate('proceed')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  };

  renderOptionalPassphrase = () => {
    const { translate } = this.context;
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
              <Text style={{ ...style.mnemonicWordText, fontSize: 15 }}>
                {translate('passphraseTitle')}
              </Text>
              <Text
                style={{
                  width: '100%',
                  fontFamily: 'Quicksand-Regular',
                  fontSize: 12,
                  marginTop: 10,
                }}
              >
                {translate('passphraseText')}
              </Text>
              <Text
                style={{
                  width: '100%',
                  fontFamily: 'Quicksand-Regular',
                  fontSize: 12,
                  marginTop: 10,
                  color: 'red',
                }}
              >
                {translate('passphraseWarning')}
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
                  placeholder={translate('enterPassphrase')}
                  onChangeText={text =>
                    this.setState({ passphraseField1: text })
                  }
                  secureTextEntry
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
                  style={{ ...style.textInput, padding: 5, fontSize: 15 }}
                  placeholder={translate('repeatPassphrase')}
                  onChangeText={text =>
                    this.setState({ passphraseField2: text })
                  }
                  secureTextEntry
                />
              </View>
              <View
                style={{
                  width: '100%',
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                }}
              >
                <TouchableOpacity
                  style={{
                    marginTop: 20,
                    padding: 10,
                    paddingRight: 50,
                    alignItems: 'center',
                  }}
                  onPress={() => {
                    Mixpanel.trackWithProperties(
                      'Backup Optional Passphrase Cancel',
                      {
                        button_text: 'Cancel',
                      }
                    );
                    this.setState({ optionalPassphraseVisible: false });
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: 'Quicksand-Medium',
                      color: 'black',
                    }}
                  >
                    {translate('cancel')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{
                    backgroundColor: 'whitesmoke',
                    marginTop: 20,
                    padding: 10,
                    paddingHorizontal: 20,
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: 'black',
                  }}
                  onPress={() => {
                    if (
                      this.state.passphraseField1.length > 0 &&
                      this.state.passphraseField2.length > 0 &&
                      this.state.passphraseField1 ===
                        this.state.passphraseField2
                    ) {
                      Mixpanel.trackWithProperties(
                        'Backup Optional Passphrase Confirm Success',
                        {
                          button_text: 'Confirm',
                        }
                      );
                      this.setState(
                        {
                          selectedPassphrase: this.state.passphraseField1,
                          optionalPassphraseVisible: false,
                        },
                        () => {
                          this.generateQuizWords();
                          this.setState({ contentMode: 'quiz' });
                        }
                      );
                    } else {
                      Mixpanel.track(
                        `BackupMnemonic Error: Passphrases don't match`
                      );
                      window.EventBus.trigger('showDropdownAlert', {
                        type: 'error',
                        title: translate('errPassphraseNoMatchTitle'),
                        message: translate('plsTryAgain'),
                      });
                    }
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: 'Quicksand-Medium',
                      color: 'black',
                    }}
                  >
                    {translate('confirm')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </View>
      </View>
    );
  };

  renderHeader = () => {
    if (this.state.contentMode == 'displayWords') {
      return (
        <View style={style.headerContainer}>
          <TouchableOpacity
            style={{
              height: 35,
              width: 35,
              justifyContent: 'center',
              alignItems: 'center',
              marginRight: 10,
            }}
            onPress={() => this.exitBackupScreen()}
          >
            <Image
              source={require('../../../assets/images/back.png')}
              style={style.backImage}
            />
          </TouchableOpacity>
          <Text style={style.headerText}>
            {this.context.translate('backupMnemonicTitle')}
          </Text>
          <TouchableOpacity
            style={style.copyButton}
            onPress={() => this.copyMnemonic()}
          >
            <Icon name="content-copy" size={30} />
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              marginLeft: 10,
            }}
            onPress={() => {
              this.setState({
                lastbitIdModalVisible: true,
              });
            }}
          >
            <MaterialCommunityIcons name="qrcode" size={30} />
          </TouchableOpacity>
        </View>
      );
    }
    if (this.state.contentMode == 'quiz') {
      return (
        <View style={style.headerContainer}>
          <View style={{ flex: 2, flexDirection: 'row' }}>
            <Text
              style={{ ...style.headerText, paddingVertical: 5 }}
              numberOfLines={1}
            >
              {this.context.translate('verifyMnemonicTitle')}
            </Text>
          </View>
          <TouchableOpacity
            style={{ flex: 1 }}
            onPress={() => {
              Mixpanel.trackWithProperties('Backup Screen Proceed Skip', {
                button_text: 'SKIP',
              });
              Alert.alert(
                this.context.translate('skipTitle'),
                this.context.translate('skipText'),
                [
                  {
                    text: this.context.translate('cancelSkip'),
                    onPress: () => {
                      Mixpanel.trackWithProperties(
                        'Backup Screen Proceed Cancel Skip',
                        {
                          button_text: 'Complete Verification',
                        }
                      );
                    },
                  },
                  {
                    text: this.context.translate('confirmSkip'),
                    style: 'destructive',
                    onPress: () => {
                      Mixpanel.trackWithProperties(
                        'Backup Screen Proceed Confirm Skip',
                        {
                          button_text: 'Skip Verification',
                        }
                      );
                      if (this.state.init) {
                        Mixpanel.track('Backup Screen Pin Visible');
                        this.setState({ pinVisible: true });
                      } else this.props.navigation.navigate('RootComponent');
                    },
                  },
                ]
              );
            }}
          >
            <View
              style={{
                ...this.context.theme.BTN_WARNING,
                flexDirection: 'row',
                justifyContent: 'center',
              }}
            >
              <Icon name="warning" size={20} />
              <Text
                style={{ marginLeft: 4, color: 'white', fontWeight: 'bold' }}
              >
                {this.context.translate('skip')}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      );
    }
    if (this.state.contentMode == 'loading') {
      return (
        <View>
          <ActivityIndicator color="black" />
        </View>
      );
    }
    return null;
  };

  renderMnemonic = () => (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 10, alignItems: 'center' }}>
        <Text
          style={{
            fontSize: 15,
            margin: 15,
            marginTop: 25,
            marginBottom: 50,
            textAlign: 'justify',
            color: '#666666',
            fontFamily: 'Quicksand-Medium',
          }}
        >
          {this.context.translate('backupMnemonicText')}
        </Text>
      </View>
      <ScrollView style={{ flex: 1, width: '100%' }} bounces={false}>
        {this.state.mnemonic.length < 24 ? (
          <View
            style={{
              flex: 1,
              width: Dimensions.get('window').width,
              height: 200,
              paddingHorizontal: '40%',
            }}
          >
            <ActivityIndicator color="black" />
          </View>
        ) : (
          <View
            style={{
              flex: 1,
              width: Dimensions.get('window').width,
              alignItems: 'center',
              paddingHorizontal: 30,
              flexDirection: 'row',
              justifyContent: 'space-evenly',
            }}
          >
            <View style={style.mnemonicColumnContainer}>
              <Text style={style.mnemonicWordText}>
                {`1. ${this.state.mnemonic[0]}`}
              </Text>
              <Text style={style.mnemonicWordText}>
                {`4. ${this.state.mnemonic[3]}`}
              </Text>
              <Text style={style.mnemonicWordText}>
                {`7. ${this.state.mnemonic[6]}`}
              </Text>
              <Text style={style.mnemonicWordText}>
                {`10. ${this.state.mnemonic[9]}`}
              </Text>
              <Text style={style.mnemonicWordText}>
                {`13. ${this.state.mnemonic[12]}`}
              </Text>
              <Text style={style.mnemonicWordText}>
                {`16. ${this.state.mnemonic[15]}`}
              </Text>
              <Text style={style.mnemonicWordText}>
                {`19. ${this.state.mnemonic[18]}`}
              </Text>
              <Text style={style.mnemonicWordText}>
                {`22. ${this.state.mnemonic[21]}`}
              </Text>
            </View>
            <View style={style.mnemonicColumnContainer}>
              <Text style={style.mnemonicWordText}>
                {`2. ${this.state.mnemonic[1]}`}
              </Text>
              <Text style={style.mnemonicWordText}>
                {`5. ${this.state.mnemonic[4]}`}
              </Text>
              <Text style={style.mnemonicWordText}>
                {`8. ${this.state.mnemonic[7]}`}
              </Text>
              <Text style={style.mnemonicWordText}>
                {`11. ${this.state.mnemonic[10]}`}
              </Text>
              <Text style={style.mnemonicWordText}>
                {`14. ${this.state.mnemonic[13]}`}
              </Text>
              <Text style={style.mnemonicWordText}>
                {`17. ${this.state.mnemonic[16]}`}
              </Text>
              <Text style={style.mnemonicWordText}>
                {`20. ${this.state.mnemonic[19]}`}
              </Text>
              <Text style={style.mnemonicWordText}>
                {`23. ${this.state.mnemonic[22]}`}
              </Text>
            </View>
            <View style={style.mnemonicColumnContainer}>
              <Text style={style.mnemonicWordText}>
                {`3. ${this.state.mnemonic[2]}`}
              </Text>
              <Text style={style.mnemonicWordText}>
                {`6. ${this.state.mnemonic[5]}`}
              </Text>
              <Text style={style.mnemonicWordText}>
                {`9. ${this.state.mnemonic[8]}`}
              </Text>
              <Text style={style.mnemonicWordText}>
                {`12. ${this.state.mnemonic[11]}`}
              </Text>
              <Text style={style.mnemonicWordText}>
                {`15. ${this.state.mnemonic[14]}`}
              </Text>
              <Text style={style.mnemonicWordText}>
                {`18. ${this.state.mnemonic[17]}`}
              </Text>
              <Text style={style.mnemonicWordText}>
                {`21. ${this.state.mnemonic[20]}`}
              </Text>
              <Text style={style.mnemonicWordText}>
                {`24. ${this.state.mnemonic[23]}`}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
      {this.state.init && (
        <View style={{ alignItems: 'center' }}>
          <TouchableOpacity
            style={this.context.theme.WIDE_BTN_CONTAINER}
            onPress={() => {
              Mixpanel.trackWithProperties(
                'Backup Screen Optional Passphrase',
                {
                  button_text: 'Add optional passphrase',
                }
              );
              this.setState({ optionalPassphraseVisible: true });
            }}
          >
            <Text style={this.context.theme.BTN_SECONDARY}>
              {this.context.translate('addPassphrase')}
            </Text>
          </TouchableOpacity>
        </View>
      )}
      <View>
        <TouchableOpacity
          style={this.context.theme.WIDE_BTN_CONTAINER}
          onPress={() => {
            Mixpanel.trackWithProperties('Backup Screen Proceed', {
              button_text: 'Proceed!',
            });
            this.generateQuizWords();
            this.setState({ contentMode: 'quiz' });
          }}
        >
          <Text style={this.context.theme.BTN_PRIMARY}>
            {this.context.translate('proceed')}
          </Text>
        </TouchableOpacity>
      </View>
      {this.state.optionalPassphraseVisible && this.renderOptionalPassphrase()}
    </View>
  );

  render() {
    const { theme } = this.context;
    return (
      <View style={{ flex: 1, alignItems: 'center' }}>
        <Modal
          visible={this.state.lastbitIdModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => this.setState({ lastbitIdModalVisible: false })}
        >
          <SafeAreaView
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.9)',
            }}
          >
            <View
              style={{
                width,
                height,
                padding: 20,
                paddingTop: 20,
                paddingBottom: 0,
                justifyContent: 'flex-start',
                alignItems: 'center',
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginTop: 10,
                  alignSelf: 'flex-start',
                }}
              >
                <TouchableOpacity
                  style={{
                    width: 24,
                    height: 24,
                    marginRight: 10,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                  onPressOut={() =>
                    this.setState({
                      lastbitIdModalVisible: false,
                    })
                  }
                >
                  <Image
                    style={{
                      width: 20,
                      height: 20,
                      resizeMode: 'contain',
                      tintColor: 'white',
                    }}
                    source={require('../../../assets/images/back.png')}
                  />
                </TouchableOpacity>
                <Text
                  style={{
                    color: 'white',
                    fontFamily: 'Quicksand-Bold',
                    fontSize: 24,
                    lineHeight: 26,
                  }}
                >
                  Back
                </Text>
              </View>
              <Text
                style={{
                  color: 'white',
                  fontFamily: 'Quicksand-Bold',
                  fontSize: 15,
                  textAlign: 'center',
                  marginVertical: 30,
                }}
              >
                Scan QR to copy your mnemonic.
              </Text>
              <View
                style={{
                  justifyContent: 'center',
                  padding: 20,
                  backgroundColor: 'white',
                }}
              >
                <QRCode value={this.state.mnemonic.join(' ')} size={250} />
              </View>
              <View style={{ flexDirection: 'row', marginVertical: 40 }}>
                <TouchableOpacity
                  style={{
                    padding: 10,
                    borderColor: 'white',
                    borderWidth: 1,
                    marginBottom: 20,
                  }}
                  onPress={() => this.copyMnemonic()}
                >
                  <Text
                    style={{
                      color: 'white',
                      fontFamily: 'Quicksand-Bold',
                      fontSize: 12,
                    }}
                  >
                    Copy Mnemonic
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
          <DropdownAlert ref={d => (this.dropdownAlert = d)} />
        </Modal>
        {this.renderHeader()}
        {this.state.contentMode == 'displayWords' && this.renderMnemonic()}
        {this.state.contentMode == 'quiz' && this.renderQuiz()}
        {this.state.pinVisible && (
          <CreatePINComponent
            mnemonic={this.state.mnemonic}
            passphrase={this.state.selectedPassphrase}
            onClose={() => this.setState({ pinVisible: false })}
            mixpanelText="Backup Screen"
          />
        )}
      </View>
    );
  }
}

const ContextWrappedComponent = props => (
  <ProvideCombinedContext>
    <BackupMnemonicScreen {...props} />
  </ProvideCombinedContext>
);

export default ContextWrappedComponent;
