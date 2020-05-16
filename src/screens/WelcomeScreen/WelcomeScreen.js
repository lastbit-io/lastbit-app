import React, { Component } from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  Clipboard,
  SafeAreaView,
  Image,
  BackHandler,
  TextInput,
  Dimensions,
  LayoutAnimation,
} from 'react-native';
import bip39 from 'bip39';
import Mixpanel from 'react-native-mixpanel';
import CreatePINComponent from 'create-pin';
import ProvideCombinedContext, { CombinedContext } from 'state-manager';
import QRCodeScanner from 'react-native-qrcode-scanner';
import style from './style';
import { CustomLayoutAnimation } from '../../shared/HelpingMethods';

class WelcomeScreen extends Component {
  static navigationOptions = {
    title: 'Welcome!',
  };

  static contextType = CombinedContext;

  constructor(props) {
    super(props);
    this.state = {
      mnemonic: [],
      contentMode: 'welcome',
      importUserMnemonic: '',
      importPassphrase: '',
      pinVisible: false,
      qrScannerVisible: false,
    };
    this.backButton = props.navigation.addListener('didFocus', payload =>
      BackHandler.addEventListener('hardwareBackPress', this.exitImportScreen)
    );
  }

  componentDidMount() {
    this.backButton = this.props.navigation.addListener('willBlur', payload =>
      BackHandler.removeEventListener(
        'hardwareBackPress',
        this.exitImportScreen
      )
    );
  }

  exitImportScreen = () => {
    const { qrScannerVisible } = this.state;
    if (qrScannerVisible) {
      LayoutAnimation.easeInEaseOut();
      this.setState({
        qrScannerVisible: false,
      });
    } else {
      Mixpanel.track('Exit Import Screen');
      this.setState({
        contentMode: 'welcome',
        importUserMnemonic: '',
        importPassphrase: '',
      });
    }

    return true;
  };

  getRange = (start, end) => {
    const array = [];
    for (let index = start; index < end; index++) {
      array.push(index);
    }
    return array;
  };

  generateMnemonic = () => {
    const mnemonic = bip39.generateMnemonic(256);
    this.setState({ mnemonic: mnemonic.split(' ') });
  };

  validateImportedMnemonic = () => {
    const valid = bip39.validateMnemonic(this.state.importUserMnemonic);
    if (valid) {
      Mixpanel.track('Imported Mnemonic Success');
      this.setState({
        mnemonic: this.state.importUserMnemonic.split(' '),
        pinVisible: true,
      });
    } else {
      Mixpanel.track(`Welcome Screen Error: Invalid input`);
      window.EventBus.trigger('showDropdownAlert', {
        type: 'error',
        title: this.context.translate('errImportInvalidMnemonicTitle'),
        message: this.context.translate('errImportInvalidMnemonicMsg'),
      });
    }
  };

  renderImportHeader = () => {
    const { translate } = this.context;
    return (
      <View style={style.headerContainer}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <TouchableOpacity
            style={{
              height: 35,
              width: 35,
              justifyContent: 'center',
              alignItems: 'center',
              marginRight: 10,
              alignSelf: 'center',
            }}
            onPress={() => this.exitImportScreen()}
          >
            <Image
              source={require('../../../assets/images/back.png')}
              style={style.backImage}
            />
          </TouchableOpacity>
          <Text style={style.headerText}>
            {translate('importMnemonicTitle')}
          </Text>
        </View>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          {!this.state.qrScannerVisible && (
            <TouchableOpacity
              style={style.pasteButton}
              onPress={async () => {
                const pastedString = await Clipboard.getString();
                this.setState({ importUserMnemonic: pastedString });
              }}
            >
              <Image
                style={{
                  width: 30,
                  height: 30,
                  resizeMode: 'contain',
                }}
                source={require('../../../assets/images/paste.png')}
              />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={style.pasteButton}
            onPress={() => {
              LayoutAnimation.easeInEaseOut();
              this.setState({ qrScannerVisible: true });
            }}
          >
            <Image
              style={{
                width: 27,
                height: 27,
                resizeMode: 'contain',
              }}
              source={require('../../../assets/images/qrscan.png')}
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  renderImportWallet = () => {
    const { translate } = this.context;
    return (
      <View style={{ flex: 1, width: '100%', alignItems: 'center' }}>
        {this.renderImportHeader()}
        <Text
          style={{
            fontSize: 15,
            margin: 15,
            marginTop: 5,
            textAlign: 'center',
            color: '#666666',
            fontFamily: 'Quicksand-Medium',
          }}
        >
          {translate('importMnemonicText')}
        </Text>
        <TextInput
          autoCorrect={false}
          autoCapitalize="none"
          placeholder={translate('importTextboxPlaceholder')}
          returnKeyType="done"
          scrollEnabled={false}
          numberOfLines={6}
          textAlignVertical="top"
          multiline
          value={this.state.importUserMnemonic}
          onChangeText={text => {
            this.setState({ importUserMnemonic: text });
          }}
          style={{
            marginTop: 20,
            width: '90%',
            height: 90,
            borderWidth: 1,
            borderColor: '#dedede',
            paddingHorizontal: 5,
          }}
        />
        <View
          style={{
            ...style.quizItemContainer,
            marginTop: 10,
            justifyContent: 'center',
          }}
        >
          <Text
            style={{ ...style.subtitleText, width: 100, textAlign: 'right' }}
          >
            {translate('passphrase')}
          </Text>
          <View
            style={{
              borderBottomColor: 'black',
              borderBottomWidth: 1,
              padding: 5,
            }}
          >
            <TextInput
              autoCorrect={false}
              autoCapitalize="none"
              placeholder={translate('optional')}
              returnKeyType="done"
              scrollEnabled={false}
              numberOfLines={1}
              multiline
              value={this.state.importPassphrase}
              onChangeText={text => {
                this.setState({ importPassphrase: text });
              }}
              style={{ ...style.subtitleText, width: 120, textAlign: 'center' }}
            />
          </View>
        </View>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            marginTop: 20,
          }}
        >
          <TouchableOpacity
            style={this.context.theme.WIDE_BTN_CONTAINER}
            onPress={this.validateImportedMnemonic}
          >
            <Text style={this.context.theme.BTN_PRIMARY}>
              {translate('proceed')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  renderWelcome = () => {
    const { translate, theme } = this.context;
    return (
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Text
          style={{
            fontFamily: 'Quicksand-Bold',
            fontSize: 30,
            marginTop: 20,
            textAlign: 'center',
            width: '100%',
          }}
        >
          {translate('welcomeTitle')}
        </Text>
        <Text style={style.welcomeText}>{translate('welcomeTextUser')}</Text>
        <TouchableOpacity
          style={theme.WIDE_BTN_CONTAINER}
          onPress={() => {
            Mixpanel.trackWithProperties('Welcome Screen Create', {
              button_text: 'Create a new wallet',
            });
            this.generateMnemonic();
            this.setState({ contentMode: 'create' });
          }}
        >
          <Text style={theme.BTN_PRIMARY} numberOfLines={1}>
            {translate('createWallet')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={theme.WIDE_BTN_CONTAINER}
          onPress={() => {
            Mixpanel.trackWithProperties('Welcome Screen Import', {
              button_text: 'Import an existing wallet',
            });
            this.setState({ contentMode: 'import' });
          }}
        >
          <Text style={theme.BTN_SECONDARY} numberOfLines={1}>
            {translate('importWallet')}
          </Text>
        </TouchableOpacity>
        {/* <View style={{ flexDirection: 'row' }}>
          <Text
            style={{ ...style.subtitleText, marginTop: 10, marginRight: 15 }}
          >
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
        </View> */}
      </View>
    );
  };

  renderQrScan = () => (
    <View style={{ flex: 1, width: '100%', alignItems: 'center' }}>
      {this.renderImportHeader()}
      <View
        style={{
          height: Dimensions.get('window').height,
          width: '100%',
          paddingHorizontal: 20,
          justifyContent: 'flex-start',
        }}
      >
        <QRCodeScanner
          containerStyle={{
            alignItems: 'center',
            height: Dimensions.get('window').height,
            position: 'relative',
          }}
          cameraStyle={{
            height: Dimensions.get('window').height,
            padding: 10,
            position: 'relative',
          }}
          cameraProps={{ captureAudio: false }}
          onRead={this.qrCodeScanned}
        />
      </View>
    </View>
  );

  qrCodeScanned = event => {
    const copiedString = event.data;
    LayoutAnimation.easeInEaseOut();
    this.setState({
      importUserMnemonic: copiedString,
      qrScannerVisible: false,
    });
  };

  render() {
    return (
      <View style={{ flex: 1 }}>
        <SafeAreaView
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          <View
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
            }}
          >
            {this.state.contentMode !== 'import' && (
              <Image
                style={{ width: 100, height: 100, resizeMode: 'contain' }}
                source={require('../../../assets/images/lastbit_L-Orange.png')}
              />
            )}
            <View
              style={{
                flex: this.state.contentMode === 'welcome' ? undefined : 1,
                width: '100%',
              }}
            >
              {this.state.contentMode === 'welcome' && this.renderWelcome()}
              {this.state.contentMode === 'create' &&
                this.props.navigation.navigate('BackupScreen', {
                  mnemonic: this.state.mnemonic,
                })}
              {this.state.contentMode === 'import' &&
                !this.state.qrScannerVisible &&
                this.renderImportWallet()}
              {this.state.contentMode === 'import' &&
                this.state.qrScannerVisible &&
                this.renderQrScan()}
            </View>
          </View>
        </SafeAreaView>
        {this.state.pinVisible && (
          <CreatePINComponent
            mnemonic={this.state.mnemonic}
            passphrase={this.state.importPassphrase}
            onClose={() => this.setState({ pinVisible: false })}
            mixpanelText="Welcome Import Passphrase"
          />
        )}
      </View>
    );
  }
}

const ContextWrappedComponent = props => (
  <ProvideCombinedContext>
    <WelcomeScreen {...props} />
  </ProvideCombinedContext>
);

export default ContextWrappedComponent;
