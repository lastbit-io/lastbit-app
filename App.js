import BackboneEvents from 'backbone-events-standalone';
import * as Keychain from 'react-native-keychain';

import {
  createAppContainer,
  createSwitchNavigator,
  createMaterialTopTabNavigator,
} from 'react-navigation';
import Reactotron from 'reactotron-react-native';
import React, { Component } from 'react';
import { MenuProvider } from 'react-native-popup-menu';
import {
  UIManager,
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  StatusBar,
  TextInput,
  AppState,
  Platform,
  ActivityIndicator,
  Dimensions,
  Linking,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

// Import all different screens for navigator
// import PairScreen from 'pair-screen';
import HomeScreen from 'home-screen';
import LightningScreen from 'lightning-screen';
import SettingsScreen from 'settings-screen';
import WelcomeScreen from 'welcome-screen';
import BackupScreen from 'backup-screen';

// Managers
import SocketManager from 'socket-manager';
import WalletManager from 'wallet-manager';
import KeyManager from 'key-manager';
import DropdownAlert from 'react-native-dropdownalert';

// Global App Contexts
import { ThemeProvider } from 'theme-manager';
import { UnitProvider } from 'unit-manager';
import { LanguageProvider, i18n, LanguageContext } from 'language-manager';
import { Sentry } from 'react-native-sentry';
import Mixpanel from 'react-native-mixpanel';
import BackgroundTimer from 'react-native-background-timer';
import AsyncStorage from '@react-native-community/async-storage';
import { firebase } from '@react-native-firebase/dynamic-links';

import CustomTabBar from './src/components/CustomTabBar';

const lockscreenImg = require('./assets/images/lockscreen.jpg');

UIManager.setLayoutAnimationEnabledExperimental &&
  UIManager.setLayoutAnimationEnabledExperimental(true);

window.EventBus = BackboneEvents.mixin({});

let timeoutId = null;

Sentry.config(
  'SENTRY API KEY'
).install();

global.Symbol = require('core-js/es6/symbol');
require('core-js/fn/symbol/iterator');
require('core-js/fn/map');
require('core-js/fn/set');
require('core-js/fn/array/find');

Reactotron.configure() // controls connection & communication settings
  .useReactNative() // add all built-in react native plugins
  .connect(); // let's connect!

const TabNavigator = createMaterialTopTabNavigator(
  {
    LightningScreen: {
      screen: LightningScreen,
      navigationOptions: {
        tabBarLabel: 'Lightning',
        tabBarIcon: ({ tintColor }) => (
          <Icon name="ios-flash" size={20} color={tintColor} />
        ),
      },
    },
    HomeScreen: {
      screen: HomeScreen,
      navigationOptions: {
        tabBarLabel: i18n.t('home'),
        tabBarIcon: ({ tintColor }) => (
          <Icon name="md-home" size={20} color={tintColor} />
        ),
      },
    },
    SettingsScreen: {
      screen: SettingsScreen,
      navigationOptions: {
        tabBarLabel: 'Settings',
        tabBarIcon: ({ tintColor }) => (
          <Icon name="ios-settings" size={20} color={tintColor} />
        ),
      },
    },
  },
  {
    tabBarPosition: 'bottom',
    animationEnabled: true,
    tabBarComponent: props => <CustomTabBar {...props} />,
    tabBarOptions: {
      showIcon: true,
      activeTintColor: '#3A59FF',
      upperCaseLabel: false,
      inactiveTintColor: 'rgba(0,0,0,0.5)',
      labelStyle: {
        fontSize: 10,
      },
      tabStyle: {
        height: 56,
      },
      indicatorStyle: {
        backgroundColor: 'transparent',
      },
      style: {
        backgroundColor: '#FFFFFF',
      },
    },
  }
);

const navigateFirebaseUrl = url => {
  const route = url.replace(/.*?:\/\//g, '');
  Reactotron.log('route firebase', route.split('?'));
  if (route.split('?')[1].includes(':')) {
    const paymentType = route.split('?')[1].split(':')[0];
    const linkAddress = route.split('?')[1].split(':')[1];
    const linkAmount = route.split('?')[2].split('=')[1];
    Reactotron.log(paymentType, linkAddress, linkAmount);
    return {
      linkAddress,
      linkAmount,
      paymentType,
    };
  }
};

const navigate = url => {
  const route = url.replace(/.*?:\/\//g, '');
  Reactotron.log('route deeplinks', route.split('?')[0].includes(':'));
  if (route.split('?')[0].includes(':')) {
    const paymentType = route.split('?')[0].split(':')[0];
    const linkAddress = route.split('?')[0].split(':')[1];
    const linkAmount =
      route.split('?').length >= 2 ? route.split('?')[1].split('=')[1] : 0;
    Reactotron.log(paymentType, linkAddress, linkAmount);
    return {
      linkAddress,
      linkAmount,
      paymentType,
    };
  }
};

class RootComponent extends Component {
  static router = TabNavigator.router;

  constructor(props) {
    super(props);
  }

  unsubscribe = null;

  state = {
    isLoadingWallet: true,
    isLoading: false,
    appState: AppState.currentState,
  };

  async componentDidMount() {
    const isImportingMnemonic = await AsyncStorage.getItem(
      'isImportingMnemonic'
    );

    this.unsubscribe = firebase.dynamicLinks().onLink(this.handleDynamicLink);

    if (Platform.OS === 'ios') {
      Linking.addEventListener('url', this.handleOpenURL);
    }

    if (!isImportingMnemonic) {
      await AsyncStorage.setItem('isImportingMnemonic', 'true');
      this.setState({
        isLoadingWallet: false,
        isLoading: true,
      });
    } else {
      this.setState({
        isLoading: true,
      });
    }

    AppState.addEventListener('change', this.handleAppStateChange);
    WalletManager.setupWalletManager();
    SocketManager.startListening(data => {
      this.dataReceivedOnStream(data).done();
    });
    window.EventBus.on('newAddressesGenerated', this.newAddressesGenerated);
  }

  componentWillUnmount() {
    Linking.removeEventListener('url', this.handleOpenURL);
    AppState.removeEventListener('change', this.handleAppStateChange);
    SocketManager.stopListening();
    window.EventBus.off('newAddressesGenerated', data => {
      this.dataReceivedOnStream(data).done();
    });
    this.unsubscribe();
  }

  handleOpenURL = event => {
    // bitcoin://n4VQ5YdHf7hLQ2gWQYYrcxoE5B7nWuDFNF?amount=10.50
    const { navigation } = this.props;
    const { linkAddress, linkAmount, paymentType } = navigate(event.url);
    if (paymentType === 'bitcoin') {
      navigation.navigate('HomeScreen', {
        linkAddress,
        linkAmount,
        paymentType,
      });
    } else if (paymentType === 'lightning') {
      navigation.navigate('LightningScreen', {
        linkAddress,
        linkAmount,
        paymentType,
      });
    }
  };

  handleDynamicLink = link => {
    // Handle dynamic link inside your own application
    const { navigation } = this.props;
    const { linkAddress, linkAmount, paymentType } = navigateFirebaseUrl(
      link.url
    );
    if (paymentType === 'bitcoin') {
      navigation.navigate('HomeScreen', {
        linkAddress,
        linkAmount,
        paymentType,
      });
    } else if (paymentType === 'lightning') {
      navigation.navigate('LightningScreen', {
        linkAddress,
        linkAmount,
        paymentType,
      });
    }
  };

  walletLoading = async () => {
    const isImportingMnemonic = await AsyncStorage.getItem(
      'isImportingMnemonic'
    );
    if (isImportingMnemonic === 'true') {
      await AsyncStorage.setItem('isImportingMnemonic', 'false');
      this.setState({
        isLoadingWallet: true,
      });
    }
  };

  handleAppStateChange = nextAppState => {
    const { navigation } = this.props;
    this.setState({ appState: nextAppState });
    if (nextAppState === 'background') {
      timeoutId = BackgroundTimer.setTimeout(() => {
        // this will be executed once after 300000 seconds
        // even when app is the the background
        navigation.navigate('LoadingComponent');
      }, 60000);
    }

    if (nextAppState === 'active') {
      BackgroundTimer.clearTimeout(timeoutId);
    }
  };

  dataReceivedOnStream = async data => {
    if (parseFloat(data.balance_change) > 0) {
      window.EventBus.trigger('showDropdownAlert', {
        type: 'success',
        title: `${data.balance_change} BTC ${i18n.translate('received')}`,
      });
    }

    // WalletManager.generateNewPublicKeys().done()
    window.EventBus.trigger('newUnconfirmedTransaction', data);
  };

  render() {
    const { navigation } = this.props;

    const linkAddress = navigation.getParam('linkAddress', null);
    const linkAmount = navigation.getParam('linkAmount', null);
    const paymentType = navigation.getParam('paymentType', null);

    const { isLoadingWallet, isLoading, appState } = this.state;

    return (
      <ThemeProvider>
        <UnitProvider>
          <SafeAreaView
            style={{
              flex: 1,
              opacity: appState === 'inactive' && Platform.OS === 'ios' ? 0 : 1,
            }}
          >
            {!isLoadingWallet && (
              <View
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  width: Dimensions.get('window').width,
                  backgroundColor: '#FFF',
                  zIndex: 10000,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <ActivityIndicator size="large" color="#000" />
                <Text
                  style={{
                    fontFamily: 'QuickSand-Medium',
                    fontSize: 15,
                    marginTop: 20,
                  }}
                >
                  Syncing wallet...
                </Text>
              </View>
            )}
            {isLoading && (
              <TabNavigator
                navigation={this.props.navigation}
                screenProps={{
                  walletLoading: this.walletLoading,
                  linkAddress,
                  linkAmount,
                  paymentType,
                }}
              />
            )}
          </SafeAreaView>
        </UnitProvider>
      </ThemeProvider>
    );
  }
}

class LoadingComponent extends Component {
  static contextType = LanguageContext;

  state = {
    contentMode: 'checking',
    pin: '',
    linkAddress: null,
    linkAmount: null,
    paymentType: null,
  };

  async componentDidMount() {
    if (Platform.OS === 'android') {
      setTimeout(async () => {
        const url = await Linking.getInitialURL();
        if (url) {
          const { linkAddress, linkAmount, paymentType } = navigate(url);
          this.setState({
            linkAddress,
            linkAmount,
            paymentType,
          });
        }
      }, 200);
    } else {
      const url = await Linking.getInitialURL();
      if (url) {
        const { linkAddress, linkAmount, paymentType } = navigate(url);
        this.setState({
          linkAddress,
          linkAmount,
          paymentType,
        });
      }
    }

    try {
      const initialLink = await firebase.dynamicLinks().getInitialLink();

      if (initialLink) {
        // Handle dynamic link inside your own application
        Reactotron.log(initialLink.url);
        const { linkAddress, linkAmount, paymentType } = navigateFirebaseUrl(
          initialLink.url
        );
        this.setState({
          linkAddress,
          linkAmount,
          paymentType,
        });
      }
      Mixpanel.sharedInstanceWithToken('Mixpanel_KEY');
      this.checkLoginStatus().done();
    } catch (error) {
      Sentry.captureException(error);
      Reactotron.log(error);
    }
  }

  setupKeys = async () => {
    const { linkAddress, linkAmount, paymentType } = this.state;
    if (this.state.pin.length === 4) {
      const response = await KeyManager.setupKeys(this.state.pin);
      if (response.success === true) {
        Mixpanel.trackWithProperties('Launch Pin Enter Success', {
          button_text: 'Proceed',
        });
        this.props.navigation.navigate('RootComponent', {
          linkAddress,
          linkAmount,
          paymentType,
        });
      } else {
        Mixpanel.track('App Launch Error: Please verify the pin entered.');
        window.EventBus.trigger('showDropdownAlert', {
          type: 'error',
          title: 'Access denied!',
          message: 'Please verify the pin entered.',
        });
      }
    } else {
      Mixpanel.track('App Launch Error: Please enter a 4 digit pin.');
      window.EventBus.trigger('showDropdownAlert', {
        type: 'error',
        title: 'Access denied!',
        message: 'Please enter a 4 digit pin.',
      });
    }
  };

  checkLoginStatus = async () => {
    const response = await KeyManager.doKeysExist();
    if (response.success === false) {
      this.props.navigation.navigate('WelcomeScreen');
    } else {
      this.setState({ contentMode: 'requestPin' });
      try {
        useBiometrics = await AsyncStorage.getItem('useBiometrics');
        if (useBiometrics) {
          data = await Keychain.getGenericPassword();
          if ('password' in data) {
            this.setState({ pin: data.password }, () => {
              this.setupKeys().done();
            });
          }
        }
      } catch (error) {}
    }
  };

  render() {
    const { theme } = this.context;
    Reactotron.log(this.context);
    return (
      <View style={{ flex: 1 }}>
        {this.state.contentMode === 'requestPin' && (
          <SafeAreaView style={{ flex: 1 }}>
            <View style={{ padding: 60, flex: 1, paddingTop: 150 }}>
              <View
                style={{
                  padding: 5,
                  borderBottomColor: 'black',
                  borderBottomWidth: 1,
                }}
              >
                <TextInput
                  placeholder={this.context.translate('enterPinPlaceholder')}
                  keyboardType="number-pad"
                  value={this.state.pin}
                  secureTextEntry
                  onChangeText={text =>
                    this.setState({ pin: text.trim().slice(0, 4) })
                  }
                  autoFocus
                  style={{
                    fontFamily: 'QuickSand-Medium',
                    fontSize: 25,
                    color: 'black',
                    textAlign: 'center',
                    width: '100%',
                  }}
                />
              </View>
              <View style={{ alignItems: 'center' }}>
                <TouchableOpacity
                  style={{
                    paddingHorizontal: 30,
                    paddingVertical: 10,
                    backgroundColor: 'whitesmoke',
                    marginTop: 30,
                    borderWidth: 1,
                    borderColor: 'black',
                  }}
                  onPress={() => this.setupKeys().done()}
                >
                  <Text>{this.context.translate('proceed')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        )}
      </View>
    );
  }
}

const AppNavigator = createSwitchNavigator(
  {
    LoadingComponent,
    WelcomeScreen,
    BackupScreen,
    RootComponent,
  },
  {
    initialRouteName: 'LoadingComponent',
  }
);

const AppContainer = createAppContainer(AppNavigator);

export default class MasterAppRegister extends Component {
  state = {
    refreshingWallet:false,
    alternateMessage:'SYNCING WALLET'
  }
  componentDidMount() {
    window.EventBus.on('showDropdownAlert', this.showDropdownAlert);
    window.EventBus.on('walletSyncTriggered', this.walletSyncTriggered);
  }

  componentWillUnmount() {
    window.EventBus.off('showDropdownAlert', this.showDropdownAlert);
    window.EventBus.off('walletSyncTriggered', this.walletSyncTriggered);
  }

  walletSyncTriggered = (data)=>{
    this.setState({refreshingWallet:!data.completed, alternateMessage:data.message?data.message:'SYNCING WALLET'})
  }

  showDropdownAlert = data => {
    this.dropdown.alertWithType(
      data.type,
      data.title ? data.title : '',
      data.message ? data.message : ''
    );
  };

  render() {
    return (
      <LanguageProvider>
        <View style={{ flex: 1 }}>
          <MenuProvider
            customStyles={{
              backdrop: { backgroundColor: 'black', opacity: 0.5 },
            }}
          >
            <View style={{ flex: 1 }}>
              <View
                style={{
                  width: '100%',
                  backgroundColor: this.state.refreshingWallet
                    ? '#FF9900'
                    : '#00204A',
                }}
              >
                <SafeAreaView style={{ width: '100%' }}>
                  <View
                    style={{
                      width: '100%',
                      padding: 10,
                      alignItems: 'center',
                      flexDirection: 'row',
                      justifyContent: 'center',
                    }}
                  >
                    {this.state.refreshingWallet && (
                      <ActivityIndicator
                        color="white"
                        style={{ width: 15, height: 15 }}
                      />
                    )}
                    <Text
                      style={{
                        color: 'white',
                        fontFamily: 'QuickSand-Bold',
                        fontSize: 12,
                        paddingLeft: 10,
                      }}
                    >
                      {this.state.refreshingWallet?this.state.alternateMessage:'TESTNET MODE ONLY'}
                    </Text>
                  </View>
                </SafeAreaView>
              </View>
              <AppContainer />
            </View>
            <DropdownAlert
              ref={ref => (this.dropdown = ref)}
              updateStatusBar={false}
            />
            <StatusBar barStyle="light-content" />
          </MenuProvider>
        </View>
      </LanguageProvider>
    );
  }
}
