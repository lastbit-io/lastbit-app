import React, { Component } from 'react';
import {
  Text,
  View,
  SafeAreaView,
  Image,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
  LayoutAnimation,
  TextInput,
  BackHandler,
  FlatList,
  Share,
  Picker,
  Modal,
  Linking,
  Clipboard,
  RefreshControl,
  Alert,
  Dimensions,
  PermissionsAndroid,
  AppState,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import NetworkManager from 'network-manager';
import moment from 'moment';
import Mixpanel from 'react-native-mixpanel';
import Slider from '@react-native-community/slider';
import AsyncStorage from '@react-native-community/async-storage';

import transaction from 'transaction-manager';
import wallet from 'wallet-manager';
import Reactotron from 'reactotron-react-native';
import bitcoin from 'rn-bitcoinjs-lib';
import config from 'config';
import bip21 from 'bip21';
import QRCode from 'react-native-qrcode-svg';
import PriceChartViewer from 'price-chart-viewer';
import QRCodeScanner from 'react-native-qrcode-scanner';
import TransactionRow from 'transaction-row';
import { Sentry, SentrySeverity } from 'react-native-sentry';
import NetInfo from '@react-native-community/netinfo';
// import { BleManager } from 'react-native-ble-plx';
import validator from 'validator';
import { ThemeConsumer } from 'theme-manager';
import { UnitConsumer } from 'unit-manager';
import ProvideCombinedContext, { CombinedContext } from 'state-manager';
import LightningManager from 'lightning-manager';
import { Base64 } from 'js-base64';
import protobuf from 'protobufjs';
import { sha256 } from 'js-sha256';
import reactotron from 'reactotron-react-native';
import generateStyleSheet from './style';
import CustomBase64 from './CustomBase64';
import { CustomLayoutAnimation } from '../../shared/HelpingMethods';

let style = false;

const { height, width } = Dimensions.get('window');

class HomeScreen extends Component {
  static contextType = CombinedContext;

  constructor(props) {
    super(props);
    this.state = {
      currentBalanceSatoshis: null,
      extendedBalanceSatoshis: null,
      utxos: [],
      extendedUtxos: [],
      transactions: [],
      broadcastedPendingTransactions: [],
      viewMode: 'balance',
      sendAddress: '', // mfhX61sajyQZjENgjm6JyKZnhF6gwMdyvn,
      sendAmount: '',
      receivingAddress: '',
      changeAddress: '',
      feePickerVisible: false,
      qrCodeScannerVisible: false,
      currentPrice: null,
      coinDelta: null,
      selectedTransaction: null,
      refreshingTransactions: false,
      unsignedTransactionResponse: null,
      walletBackedUp: false,
      recommendedFee: null,
      selectedFee: null,
      selectedService: null,
      characteristics: null,
      blePrefixUUID: '6e40000',
      hardwareConfirmed: true,
      waitingForDevice: false,
      hardwareData: '',
      hardwareDataReceived: false,
      broadcastingTx: false,
      isConnected: false,
    };

    this.movedAwayFromBalance = props.navigation.addListener(
      'didFocus',
      payload =>
        BackHandler.addEventListener(
          'hardwareBackPress',
          this.onBackButtonPressAndroid
        )
    );
  }

  componentDidMount() {
    this.fetchUTXOs().done();
    this.getSuggestedNetworkFee().done();
    this.fetchCachedTransactions().done();
    this.getCurrentReceivingAddress().then(() => {
      this.subscribeToUnconfirmedTransactions();
      this.subscribeToNewAddresses();
      this.getLatestPrice();
    });

    AppState.addEventListener('change', this.handleAppStateChange);

    const { linkAddress, linkAmount, paymentType } = this.props.screenProps;
    Reactotron.log('HOME SCREEN', linkAddress, linkAmount);
    if (linkAddress) {
      if (this.state.refreshingTransactions) {
        Mixpanel.track('Homescreen Error: warnUpdateInfoMsg', {
          level: SentrySeverity.Warning,
        });
        window.EventBus.trigger('showDropdownAlert', {
          type: 'warn',
          title: this.context.translate('warnUpdateInfoTitle'),
          message: this.context.translate('warnUpdateInfoMsg'),
        });
      } else if (this.state.currentBalanceSatoshis == 0) {
        Mixpanel.track(
          'Homescreen Error: Please ensure you have a non-zero balance.'
        );
        window.EventBus.trigger('showDropdownAlert', {
          type: 'error',
          title: this.context.translate('errNoBalanceTitle'),
          message: this.context.translate('errNoBalanceMsg'),
        });
      } else if (paymentType === 'bitcoin') {
        this.handleDeepLinkingValue(linkAddress, linkAmount);
      }
    }
    this.subscription = NetInfo.addEventListener(this.handleConnectivityChange);

    this.startTrackTimer = this.props.navigation.addListener('didFocus', () => {
      const { navigation } = this.props;
      Mixpanel.timeEvent('Home Screen Tab');
      reactotron.log('navigation.state.params', navigation.state.params);
      const { params } = navigation.state;
      if (
        params &&
        params.linkAddress &&
        params.linkAmount &&
        params.paymentType === 'bitcoin'
      ) {
        this.handleDeepLinkingValue(params.linkAddress, params.linkAmount);
      }
    });

    this.endTrackTimer = this.props.navigation.addListener('didBlur', () =>
      Mixpanel.track('Home Screen Tab')
    );

    this.movedToBalance = this.props.navigation.addListener(
      'willBlur',
      payload =>
        BackHandler.removeEventListener(
          'hardwareBackPress',
          this.onBackButtonPressAndroid
        )
    );
    this.checkWalletBackedUp();
  }

  componentWillUnmount() {
    this.disconnectToUnconfirmedTransactions();
    this.dissconnectToNewAddresses();
    this.removeScheduledFetchStatusOfUnconfirmedTransactions();
    if (this.state.characteristics != null) {
      this.subscription.remove();
    }
    this.movedAwayFromBalance && this.movedAwayFromBalance.remove();
    this.movedToBalance && this.movedToBalance.remove();
    this.startTrackTimer && this.startTrackTimer.remove();
    this.endTrackTimer && this.endTrackTimer.remove();
    this.subscription && this.subscription();
    AppState.removeEventListener('change', this.handleAppStateChange);
  }

  handleAppStateChange = nextAppState => {
    reactotron.log(
      'CURRENT STATE',
      nextAppState,
      this.props.navigation.state.params
    );
    if (nextAppState === 'active') {
      setTimeout(() => {
        const { navigation } = this.props;
        const { params } = navigation.state;
        if (
          params &&
          params.linkAddress &&
          params.linkAmount &&
          params.paymentType === 'bitcoin'
        ) {
          this.handleDeepLinkingValue(params.linkAddress, params.linkAmount);
        }
      }, 200);
    }
  };

  handleDeepLinkingValue = (linkAddress, linkAmount) => {
    const { unitConverter } = this.context;
    this.props.handleSwipeGesture(false);
    Reactotron.log(
      'handleDeepLinkingValue',
      Number.isInteger(linkAmount),
      linkAmount
    );
    const sendAmount = Number.isInteger(Number(linkAmount))
      ? `${unitConverter(Number(linkAmount)).nonSciString.split(' ')[0]}`
      : `${
          unitConverter(Number(linkAmount * 100000000)).nonSciString.split(
            ' '
          )[0]
        }`;
    this.setState({
      viewMode: 'send',
      sendAddress: linkAddress,
      sendAmount: linkAmount ? sendAmount : 0,
    });
  };

  handleConnectivityChange = state => {
    this.setState({
      isConnected: state.isConnected,
    });
  };

  handleCheckForNetwork = () => {
    const { isConnected } = this.state;
    if (!isConnected) {
      window.EventBus.trigger('showDropdownAlert', {
        type: 'error',
        title: this.context.translate('error'),
        message: this.context.translate('errNoInternet'),
      });
      return false;
    }
    return true;
  };

  requestPermissions = async () => {
    try {
      const granted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION
      );
      if (granted) {
        AsyncStorage.setItem('location_perm', 'y');
        Reactotron.log('Permissions granted');
        this.connectToGO();
      } else {
        await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
          {
            title: this.context.translate('permissionsPromptTitle'),
            message: this.context.translate('permissionsPromptText'),
            buttonNegative: this.context.translate('deny'),
            buttonPositive: this.context.translate('grant'),
          }
        );
      }
    } catch (err) {
      Sentry.captureException(err);
      Reactotron.log(err);
    }
  };

  getSuggestedNetworkFee = async () => {
    const response = await NetworkManager.getRecommendedBitcoinFee();
    if (response.success === true) {
      this.setState({
        recommendedFee: response.fee,
        selectedFee: response.fee.hourFee,
      });
      Reactotron.log('response.fee');
      Reactotron.log(response.fee);
    } else {
      this.setState({
        recommendedFee: {
          defaultFee: 55,
        },
        selectedFee: 55,
      });
    }
  };

  checkWalletBackedUp = async () => {
    const walletBackedUp = await AsyncStorage.getItem('userBackedUpMnemonic');
    if (walletBackedUp == 'yes') {
      this.setState({ walletBackedUp: true });
    }
  };

  onBackButtonPressAndroid = () => {
    if (this.state.viewMode === 'send') {
      this.sendViewBackButtonPressed();
      return true;
    }
    if (this.state.viewMode !== 'balance') {
      this.resetToBalance();
      return true;
    }
    return false;
  };

  subscribeToNewAddresses = () => {
    window.EventBus.on('newAddressesGenerated', this.newAddressesGenerated);
    window.EventBus.on('walletRescanRequested', this.rescanUtil);
  };

  dissconnectToNewAddresses = () => {
    window.EventBus.off('newAddressesGenerated', this.newAddressesGenerated);
    window.EventBus.off('walletRescanRequested', this.rescanUtil);
  };

  rescanUtil = () => {
    this.rescanWallet().done();
  };

  rescanWallet = async () => {
    this.setState({
      utxos: [],
      extendedUtxos: [],
      transactions: [],
      currentBalanceSatoshis: null,
      extendedBalanceSatoshis: null,
    });
    this.newAddressesGenerated();
    await this.fetchUTXOs().done();
    window.EventBus.trigger('rescanWalletCompleted');
  };

  newAddressesGenerated = () => {
    this.getCurrentReceivingAddress().done();
  };

  disconnectToUnconfirmedTransactions = () => {
    window.EventBus.off(
      'newUnconfirmedTransaction',
      this.processUnconfirmedTransactions
    );
  };

  subscribeToUnconfirmedTransactions = () => {
    window.EventBus.on(
      'newUnconfirmedTransaction',
      this.processUnconfirmedTransactions
    );
  };

  processUnconfirmedTransactions = data => {
    Reactotron.log({ NewTransactionReceived: data });
    this.fetchUTXOs().done();
    this.resetToBalance();
  };

  getCurrentReceivingAddress = async () => {
    const {
      receivingPubKey,
      changePubKey,
    } = await wallet.getCurrentIndexPublicKeys();

    // const receivingAddress = bitcoin.payments.p2pkh({
    //   pubkey: receivingPubKey.publicKey,
    //   network: config.bitcoinNetwork,
    // }).address;
    // const changeAddress = bitcoin.payments.p2pkh({
    //   pubkey: changePubKey.publicKey,
    //   network: config.bitcoinNetwork,
    // }).address;

    const receivingAddress = bitcoin.payments.p2sh({
      redeem: bitcoin.payments.p2wpkh({
        pubkey: receivingPubKey.publicKey,
        network: config.bitcoinNetwork,
      }),
    }).address;
    const changeAddress = bitcoin.payments.p2sh({
      redeem: bitcoin.payments.p2wpkh({
        pubkey: changePubKey.publicKey,
        network: config.bitcoinNetwork,
      }),
    }).address;

    Reactotron.log('getCurrentReceivingAddresss was called', receivingAddress);
    this.setState({
      receivingAddress,
      changeAddress,
    });
  };

  fetchCachedTransactions = async () => {
    const storedResponse = await transaction.fetchCachedConsolidatedTransactions();
    if (storedResponse.success == true) {
      this.setState({ transactions: storedResponse.consolidatedTransactions });
    }
  };

  fetchTransactionHistory = async () => {
    const response = await transaction.fetchPreviousTransactions();

    if (response.success == true) {
      const { broadcastedPendingTransactions } = this.state;

      const newBroadcastedPendingTransactions = [];

      broadcastedPendingTransactions.forEach(broadcastedPendingTransaction => {
        let found = false;
        response.consolidatedTransactions.forEach(consolidatedTransaction => {
          if (
            consolidatedTransaction.txid === broadcastedPendingTransaction.txid
          ) {
            found = true;
          }
        });
        if (found === false) {
          newBroadcastedPendingTransactions.push(broadcastedPendingTransaction);
        }
      });

      this.setState({
        transactions: response.consolidatedTransactions,
        broadcastedPendingTransactions: newBroadcastedPendingTransactions,
      });
    }

    Reactotron.log('State set transaction history', {
      transactionsReceivedHomescreen: response.consolidatedTransactions,
    });
  };

  scheduleFetchStatusOfUnconfirmedTransactions = () => {
    this.unconfirmedTransactionsPreriodicTask = setInterval(() => {
      this.fetchUnconfirmedTransactionStatuses().done();
    }, 180000);
  };

  removeScheduledFetchStatusOfUnconfirmedTransactions = () => {
    if (this.unconfirmedTransactionsPreriodicTask) {
      clearInterval(this.unconfirmedTransactionsPreriodicTask);
    }
  };

  fetchUnconfirmedTransactionStatuses = async () => {
    if (this.state.transactions) {
      const unconfirmedTransactions = this.state.transactions.filter(
        transaction => transaction.confirmations < 6
      );
      if (unconfirmedTransactions.length > 0) {
        await this.fetchUTXOs().done();
      }
    }
  };

  fetchUTXOs = async fetchType => {
    this.setState({ refreshingTransactions: true });

    const cachedUtxos = await AsyncStorage.getItem('cachedUtxos');
    const cachedBalance = await AsyncStorage.getItem('cachedBalance');

    if (cachedUtxos && !fetchType) {
      this.setState({ utxos: JSON.parse(cachedUtxos) });
    }

    if (cachedBalance && !fetchType) {
      this.setState({ currentBalanceSatoshis: parseInt(cachedBalance) });
    }

    await this.fetchTransactionHistory();
    const receiveResponse = await NetworkManager.getUTXOs();

    if (receiveResponse && receiveResponse.success) {
      const utxos = Object.values(receiveResponse.utxos);
      const extendedUtxos = Object.values(receiveResponse.extendedUtxos);

      const satoshiBalance = receiveResponse.satoshis;
      const extendedBalance = receiveResponse.extendedSatoshis;
      const cachedSatoshiBalance = await wallet.getCachedSatoshiBalance();

      if (!this.unconfirmedTransactionsPreriodicTask) {
        this.scheduleFetchStatusOfUnconfirmedTransactions();
      }

      if (satoshiBalance !== cachedSatoshiBalance) {
        await wallet.setCachedSatoshiBalance(satoshiBalance);
        await this.getCurrentReceivingAddress();
      }

      AsyncStorage.setItem('cachedUtxos', JSON.stringify(utxos));
      AsyncStorage.setItem('cachedBalance', `${satoshiBalance}`);

      const broadcastingUtxos = [];
      this.state.broadcastedPendingTransactions.forEach(
        broadcastedPendingTransaction => {
          broadcastingUtxos.push(...broadcastedPendingTransaction.utxos);
        }
      );

      const nonBroadcastingUtxos = utxos.filter(utxo => {
        broadcastingUtxos.forEach(broadcastingUtxo => {
          if (
            utxo.txid == broadcastingUtxo.txid &&
            utxo.vout == broadcastingUtxo.vout
          ) {
            return false;
          }
        });
        return true;
      });

      nonBroadcastingSatoshiBalance = 0;
      nonBroadcastingUtxos.forEach(utxo => {
        nonBroadcastingSatoshiBalance += utxo.satoshis;
      });

      this.setState({
        utxos: nonBroadcastingUtxos,
        extendedUtxos,
        currentBalanceSatoshis: nonBroadcastingSatoshiBalance,
        extendedBalanceSatoshis: extendedBalance,
      });
    } else {
      Mixpanel.track(
        'Homescreen Error: Please check your internet connection and try again.'
      );
      window.EventBus.trigger('showDropdownAlert', {
        type: 'error',
        title: this.context.translate('error'),
        message: this.context.translate('errNoInternet'),
      });
    }

    this.setState({ refreshingTransactions: false });
  };

  sendMax = async () => {
    if (!this.state.sendAddress) {
      window.EventBus.trigger('showDropdownAlert', {
        type: 'error',
        title: 'Please enter valid recipient address',
        message: '',
      });
      return;
    }

    try {
      const unsignedTransactionResponse = await transaction.getUnsignedTransaction(
        this.state.utxos,
        [
          {
            address: this.state.sendAddress,
            value: this.state.currentBalanceSatoshis - 20000,
          },
        ],
        0
      );

      Reactotron.log({ unsignedTransactionResponse });
      // let hex = transaction.inAppSignTransaction(this.state.unsignedTransactionResponse.tb, this.state.unsignedTransactionResponse.orderedUtxos)
      const hex = transaction.inAppSignTransaction(
        unsignedTransactionResponse.tb,
        unsignedTransactionResponse.orderedUtxos
      );

      const sizeInBytes = parseInt(hex.length / 2);
      const fee = sizeInBytes * this.state.selectedFee;
      const maxAmountSatoshis = this.state.currentBalanceSatoshis - fee;
      let amountStr =
        this.context.unit.conversionName == 'fiat'
          ? (
              (this.context.unit.multiplier * maxAmountSatoshis) /
              100000000
            ).toFixed(2)
          : maxAmountSatoshis / this.context.unit.multiplier;
      amountStr += '';
      this.setState({ sendAmount: amountStr });
    } catch (error) {
      // alert(error)
    }
  };

  generateSigHashes = async amount => {
    Reactotron.log({
      Utxos: this.state.utxos,
      sendAddress: this.state.sendAddress,
      amount,
    });
    const unsignedTransactionResponse = await transaction.getUnsignedTransaction(
      this.state.utxos,
      [
        {
          address: this.state.sendAddress,
          value: amount,
        },
      ],
      this.state.selectedFee
    );

    const { success, message } = unsignedTransactionResponse;

    // FIXME Translations
    if (success === false) {
      window.EventBus.trigger('showDropdownAlert', {
        type: 'error',
        title: 'Something went wrong.',
        message,
      });
      return;
    }

    Reactotron.log({ unsignedTransactionResponse });

    LayoutAnimation.configureNext(CustomLayoutAnimation(200));
    this.setState({ unsignedTransactionResponse, sendAmount: amount });
  };

  signAndBroadcastTransaction = async () => {
    this.setState({ broadcastingTx: true, refreshingTransactions: true });
    const hex = transaction.inAppSignTransaction(
      this.state.unsignedTransactionResponse.tb,
      this.state.unsignedTransactionResponse.orderedUtxos
    );
    Reactotron.log({ hex });

    const response = await NetworkManager.broadcastTransaction(hex);

    this.setState({ refreshingTransactions: false });

    if (response.success === true) {
      const { broadcastedPendingTransactions } = this.state;

      const pendingTransaction = {
        txid: response.txid,
        utxos: this.state.unsignedTransactionResponse.orderedUtxos,
        timestamp: +new Date(),
      };

      const nonBroadcastingUtxos = this.state.utxos.filter(utxo => {
        pendingTransaction.utxos.forEach(pendingUtxo => {
          if (pendingUtxo.txid == utxo.txid && pendingUtxo.vout == utxo.vout) {
            return false;
          }
        });
        return true;
      });

      let nonBroadcastingSatoshiBalance = 0;
      nonBroadcastingUtxos.forEach(nonBroadcastingUtxo => {
        nonBroadcastingSatoshiBalance += nonBroadcastingUtxo.amount;
      });

      this.setState({
        utxos: nonBroadcastingUtxos,
        currentBalanceSatoshis: nonBroadcastingSatoshiBalance,
      });

      broadcastedPendingTransactions.push(pendingTransaction);

      Reactotron.log({ broadcastedPendingTransactions });

      this.setState(
        { refreshingTransactions: true, broadcastedPendingTransactions },
        async () => {
          await this.fetchUTXOs('send');
          Reactotron.log({
            broadcastedPendingTransactions: this.state
              .broadcastedPendingTransactions,
          });
          if (this.state.broadcastedPendingTransactions.length > 0) {
            setTimeout(async () => {
              await this.fetchUTXOs('send');
              if (this.state.broadcastedPendingTransactions.length > 0) {
                setTimeout(async () => {
                  await this.fetchUTXOs('send');
                  if (this.state.broadcastedPendingTransactions.length > 0) {
                    setTimeout(async () => {
                      await this.fetchUTXOs('send');
                      if (
                        this.state.broadcastedPendingTransactions.length > 0
                      ) {
                        this.setState({ broadcastedPendingTransactions: [] });
                        await this.fetchUTXOs('send');
                      }
                    }, 10000);
                  }
                }, 10000);
              }
            }, 10000);
          }
        }
      );

      Mixpanel.trackWithProperties('Home Transaction Send Success', {
        message: this.context.translate('successTxBroadcastMsg'),
      });

      window.EventBus.trigger('showDropdownAlert', {
        type: 'success',
        title: this.context.translate('successTxBroadcastTitle'),
        message: this.context.translate('successTxBroadcastMsg'),
      });
    }

    this.resetToBalance();

    // transaction.harcodeSignTransaction(tb)

    // let {
    //     finalString,
    //     lengthString
    // } = bluetooth.constructSighashSendString(this.state.sendAddress, sighashes)

    // let transactionHash = await transaction.signBuildTransaction(
    //     tb,
    //     orderedInputs,
    //     [
    //         {
    //             path:'m/44/1/1/0/0',
    //             pubkey:'030d03dad931aad07d4bff0979b9d4b15a565e6928dcd0af8482c38dd84c6dce9a',
    //             sighash:'6510d970ec50c18b945fbd4894cfedd656146476b5a9b67e4e673ab9eb0f7bd6',
    //             signature:'7443566c620d3f9ebc15188357abbe52221fb4553ee29bb9a1f81c80f2e1c5af470e41c6e556324ab0d757dc7b02c95976c338220fa6bdfff44699d96b169581'
    //         },
    //         {
    //             path:'m/44/1/1/0/1',
    //             pubkey:'03d96a88a10a440eb3749eea49106092fcf27bab0646909ac019bb03dd048db0d4',
    //             sighash:'2cce7868275f370cb19001f84a0369776550c584e1200f11762de1c421737fae',
    //             signature:'c3ff1664172a192df200324ea54144b9222484ba1e02bb8d9c636814d37f607117a8d78050f932c89694ffc01808497571a8a456b722243b018923d2be38744c'
    //         }
    //     ]
    // )

    // await bluetooth.sendDataToPairedDevice(lengthString)
  };

  qrCodeScanned = event => {
    const { data } = event;
    try {
      const decoded = bip21.decode(data);
      this.setState({
        sendAddress: decoded.address,
      });
      if (decoded.options.amount) {
        this.setState({ sendAmount: `${decoded.options.amount}` });
      }
    } catch (error) {
      Sentry.captureException(error);
      window.EventBus.trigger('showDropdownAlert', {
        type: 'error',
        title: this.context.translate('errScanningQRCode'),
        message: error,
      });
    }

    this.hideQRCodeScanner();
  };

  validateAddress = address => {
    try {
      bitcoin.address.toOutputScript(
        this.state.sendAddress,
        config.bitcoinNetwork
      );
      return true;
    } catch (error) {
      Sentry.captureException(error);
      window.EventBus.trigger('showDropdownAlert', {
        type: 'error',
        title: this.context.translate('invalidInput'),
        message: this.context.translate('errInvalidAddress'),
      });
      return false;
    }
  };

  // TODO: Make common onButtonPress goto route in param
  sendPressed = () => {
    const { translate } = this.context;
    const isConnected = this.handleCheckForNetwork();
    if (!isConnected) {
      return;
    }
    this.props.handleSwipeGesture(false);
    LayoutAnimation.configureNext(CustomLayoutAnimation(200));
    if (this.state.viewMode === 'send') {
      if (this.state.unsignedTransactionResponse !== null) {
        Reactotron.log(
          this.state.characteristics,
          this.state.hardwareConfirmed
        );
        if (
          !this.state.characteristics ||
          (!!this.state.characteristics && this.state.hardwareConfirmed)
        ) {
          this.signAndBroadcastTransaction().done();
        }
      } else {
        if (validator.isNumeric(`${this.state.sendAmount}`)) {
          if (this.context.unit.id == 0) {
            if (!validator.isInt(`${this.state.sendAmount}`)) {
              Mixpanel.track('Homescreen Error: Satoshis are indivisible');
              window.EventBus.trigger('showDropdownAlert', {
                type: 'error',
                title: translate('errFractionalSatsTitle'),
                message: translate('errFractionalSatsMsg'),
              });
              return;
            }
          }
        } else {
          Mixpanel.track(
            'Homescreen Error: Please enter a valid non zero amount'
          );
          window.EventBus.trigger('showDropdownAlert', {
            type: 'error',
            title: translate('invalidInput'),
            message: translate('errInvalidAmount'),
          });
          return;
        }

        if (!this.validateAddress(this.state.sendAddress)) {
          Mixpanel.track(
            'Homescreen Error: Please enter a valid non zero amount'
          );
          window.EventBus.trigger('showDropdownAlert', {
            type: 'error',
            title: translate('invalidInput'),
            message: translate('errInvalidAddress'),
          });
          return;
        }
        let amount =
          this.context.unit.conversionName == 'fiat'
            ? (this.state.sendAmount / this.context.unit.multiplier) * 100000000
            : this.state.sendAmount * this.context.unit.multiplier;
        amount = Math.round(amount);
        if (this.state.sendAmount.length === 0 || amount <= 0) {
          Mixpanel.track(
            'Homescreen Error: Please enter a valid non zero amount'
          );
          window.EventBus.trigger('showDropdownAlert', {
            type: 'error',
            title: translate('invalidInput'),
            message: translate('errInvalidAmount'),
          });
          return;
        }
        if (amount > 0 && amount <= this.state.currentBalanceSatoshis) {
          if (this.state.characteristics != null) {
            this.setState({ waitingForDevice: true, hardwareConfirmed: false });
            this.sendTxToDevice();
          }
          this.generateSigHashes(amount).done();
        } else {
          Mixpanel.track(
            'Homescreen Error: Please ensure your input is valid and that you have sufficient funds.'
          );
          window.EventBus.trigger('showDropdownAlert', {
            type: 'error',
            title: translate('error'),
            message: translate('errPayFailMsg'),
          });
        }
      }
    } else if (this.state.refreshingTransactions) {
      this.props.handleSwipeGesture(true);
      Mixpanel.track('Homescreen Error: warnUpdateInfoMsg', {
        level: SentrySeverity.Warning,
      });
      window.EventBus.trigger('showDropdownAlert', {
        type: 'warn',
        title: translate('warnUpdateInfoTitle'),
        message: translate('warnUpdateInfoMsg'),
      });
    } else if (this.state.currentBalanceSatoshis == 0) {
      this.props.handleSwipeGesture(true);
      Mixpanel.track(
        'Homescreen Error: Please ensure you have a non-zero balance.'
      );
      window.EventBus.trigger('showDropdownAlert', {
        type: 'error',
        title: translate('errNoBalanceTitle'),
        message: translate('errNoBalanceMsg'),
      });
    } else {
      if (this.state.broadcastedPendingTransactions.length > 0) {
        window.EventBus.trigger('showDropdownAlert', {
          type: 'warn',
          title: 'Refreshing wallet',
          message:
            'We are processing a recently broadcasted transaction. Please wait for the transaction to propagate.',
        });
        return;
      }
      this.setState({ viewMode: 'send' });
    }
  };

  receivePressed = () => {
    Mixpanel.track('Home Receive Pressed');
    this.props.handleSwipeGesture(false);
    LayoutAnimation.configureNext(CustomLayoutAnimation(200));
    this.setState({ viewMode: 'receive' });
  };

  resetToBalance = () => {
    LayoutAnimation.configureNext(CustomLayoutAnimation(200));
    this.props.handleSwipeGesture(true);
    this.setState({
      viewMode: 'balance',
      feePickerVisible: false,
      qrCodeScannerVisible: false,
      unsignedTransactionResponse: null,
      sendAddress: '',
      sendAmount: '',
      waitingForDevice: false,
      broadcastingTx: false,
    });
  };

  portfolioPressed = () => {
    if (this.state.transactions && this.state.transactions.length > 0) {
      LayoutAnimation.configureNext(CustomLayoutAnimation(200));
      this.setState({ viewMode: 'portfolio' });
    } else {
      window.EventBus.trigger('showDropdownAlert', {
        type: 'info',
        title: 'No transactions exist!',
        message: '',
      });
    }
  };

  displayWarningInfo = () => {
    const { translate } = this.context;
    Alert.alert(
      translate('warnUnsafeMobileTitle'),
      translate('warnUnsafeMobileMsg'),
      [
        {
          text: translate('notInterested'),
          style: 'cancel',
          onPress: () => {},
        },
        {
          text: translate('showMe'),
          onPress: () => {
            Linking.openURL('https://lastbit.io/hardware/');
          },
        },
      ]
    );
  };

  marketsPressed = () => {
    const isConnected = this.handleCheckForNetwork();
    if (!isConnected) {
      return;
    }
    this.props.handleSwipeGesture(false);
    Mixpanel.track('Home Market Pressed');
    LayoutAnimation.configureNext(CustomLayoutAnimation(200));
    this.setState({ viewMode: 'markets' });
  };

  settingsPressed = () => {
    LayoutAnimation.configureNext(CustomLayoutAnimation(200));

    this.setState({ viewMode: 'settings' });
  };

  sendViewBackButtonPressed = () => {
    const { navigation } = this.props;
    const { params } = navigation.state;
    if (params && params.linkAddress) {
      navigation.setParams({ linkAddress: null, linkAmount: null });
    }
    this.props.handleSwipeGesture(true);
    if (this.state.qrCodeScannerVisible) {
      this.hideQRCodeScanner();
    } else {
      this.resetToBalance();
    }
  };

  hideQRCodeScanner = () => {
    LayoutAnimation.configureNext(CustomLayoutAnimation(200));

    this.props.handleSwipeGesture(false);
    this.setState({ qrCodeScannerVisible: false });
  };

  getLatestPrice = async () => {
    try {
      let currentPrice = '9999';
      let coinDelta = 4.2;
      // Get latest Price
      const response = await fetch(
        'https://min-api.cryptocompare.com/data/generateAvg?fsym=BTC&tsym=USD&e=Kraken'
      );
      const responseJson = await response.json();
      currentPrice = responseJson.RAW.PRICE;
      coinDelta = responseJson.RAW.CHANGEPCT24HOUR.toFixed(2);
      this.setState({ currentPrice, coinDelta });
    } catch (error) {
      Sentry.captureException(error);
    }
  };

  renderCurrentWalletValueText = coinUnitObj => {
    if (
      this.state.currentPrice !== null &&
      this.state.currentBalanceSatoshis !== null
    ) {
      if (
        this.state.currentBalanceSatoshis !== this.state.extendedBalanceSatoshis
      ) {
        return (
          <Text
            style={{
              fontFamily: 'Quicksand-Regular',
              fontSize: this.context.theme.FONT_SIZE_MEDIUM || 15,
              color: this.context.theme.PRIMARY_COLOR,
              marginTop: 5,
              textAlign: 'center',
            }}
          >{`${
            coinUnitObj.unitConverter(
              this.state.extendedBalanceSatoshis -
                this.state.currentBalanceSatoshis
            ).nonSciString
          }\n${this.context.translate('awaitingConfirmedFunding')}`}</Text>
        );
      }
      return (
        <Text
          style={{
            marginTop: 10,
            fontFamily: 'Quicksand-Medium',
            fontSize: 18,
            color: '#333333',
            textAlign: 'center',
          }}
        >
          {this.context.translate('balanceSubtitle')}
        </Text>
      );
    }
    return <View />;
  };

  renderBalanceContainer = () => {
    const balanceContainerHeight =
      this.state.viewMode === 'balance' &&
      this.state.transactions.length == 0 &&
      this.state.currentBalanceSatoshis === 0
        ? 140
        : 100;
    return (
      <View
        style={[style.balanceContainer, { height: balanceContainerHeight }]}
      >
        {this.state.currentBalanceSatoshis !== null ? (
          <View style={{ alignItems: 'center' }}>
            <View style={style.actionButton}>
              <UnitConsumer>
                {coinUnitObj => (
                  <TouchableOpacity
                    style={{ alignItems: 'center' }}
                    onPress={() => {
                      coinUnitObj.cycleUnits();
                      Mixpanel.trackWithProperties('Home Change Currency', {
                        currency: coinUnitObj.unit.displayName,
                      });
                    }}
                  >
                    <Text style={style.balanceTitleText}>
                      {
                        coinUnitObj.unitConverter(
                          this.state.currentBalanceSatoshis
                        ).nonSciString
                      }
                    </Text>
                    {this.renderCurrentWalletValueText(coinUnitObj)}
                  </TouchableOpacity>
                )}
              </UnitConsumer>
              {/* <Text style={style.balanceSubtitleText}>Available to spend OnChain</Text> */}
            </View>
            {balanceContainerHeight === 140 && (
              <TouchableOpacity
                style={{
                  marginVertical: 20,
                  alignItems: 'center',
                  padding: 5,
                  paddingHorizontal: 10,
                  borderColor: 'black',
                  borderWidth: 1,
                  backgroundColor: 'white',
                }}
                onPress={() =>
                  Linking.openURL('https://bitcoinfaucet.uo1.net/')
                }
              >
                <Text
                  style={{
                    color: 'black',
                    textAlign: 'center',
                    fontFamily: 'Quicksand-Medium',
                  }}
                >
                  {this.context.translate('testnetFaucetTitle')}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={{ alignItems: 'center' }}>
            <ActivityIndicator
              style={style.balanceActivityIndicator}
              color="black"
            />
          </View>
        )}
      </View>
    );
  };

  connectToGO = async () => {
    const granted = await AsyncStorage.getItem('location_perm');
    Reactotron.log(granted);
    if (granted != 'y') {
      this.requestPermissions();
    } else {
      // FIXME
      // this.manager = new BleManager();
      Reactotron.log('Connecting');
      this.subscription = this.manager.onStateChange(state => {
        Reactotron.log(state);
        if (state === 'PoweredOn') {
          this.scanAndConnect();
          this.subscription.remove();
        }
      }, true);
    }
  };

  disconnectFromGo = async () => {
    await this.device.cancelConnection();
    this.setState({
      characteristics: null,
      hardwareConfirmed: true,
      waitingForDevice: false,
    });
  };

  scanAndConnect() {
    this.manager.startDeviceScan(null, null, async (error, device) => {
      if (error) {
        alert(error);
        this.setState({ characteristics: null });
        this.device = null;
        this.resetToBalance();
        return;
      }

      Reactotron.log({ device });

      if (device.id) {
        if (device.name.startsWith('HODLER')) {
          this.manager.stopDeviceScan();
          await device.connect();
          await device.discoverAllServicesAndCharacteristics();
          const services = await device.services();
          const selectedService = services.find(serv =>
            serv.uuid.startsWith(this.state.blePrefixUUID)
          );
          Reactotron.log({ selectedService });
          const characteristics = await selectedService.characteristics();
          Reactotron.log({ characteristics });
          this.setState({ selectedService, characteristics });
          await this.startMonitoring();
          this.device = device;
        }
      }
    });
  }

  sendTxToDevice = async amountSats => {
    const characteristic = this.state.characteristics.find(
      char => char.isWritableWithoutResponse || char.isWritableWithResponse
    );
    Reactotron.log('Attempting to write:', characteristic);
    const jsonDescriptor = require('./sample.json');
    const root = protobuf.Root.fromJSON(jsonDescriptor);
    const Book = root.lookupType('com.book.Book');
    const payload = {
      isbn: 500,
      title: this.state.receivingAddress,
      author: `To: ${this.state.sendAddress.slice(
        0,
        4
      )}..${this.state.sendAddress.slice(
        -4
      )},Amt:${this.state.sendAmount.toString()} ${
        this.context.unit.displayName
      }`,
    };
    Reactotron.log(payload);
    const message = Book.create(payload);
    const buffer = Book.encode(message).finish();
    const sha = sha256.arrayBuffer(buffer);
    const shaArray = new Uint8Array(sha);
    const paddedArray = new Uint8Array([
      ...buffer,
      shaArray[0],
      shaArray[1],
      shaArray[2],
      shaArray[3],
    ]);
    const { length } = paddedArray;

    let hexLengthString = length.toString(16);

    if (hexLengthString.length > 4) {
      return;
    }
    while (hexLengthString.length !== 4) {
      hexLengthString = `0${hexLengthString}`;
    }

    const finalByteArray = new Uint8Array([
      51,
      parseInt(hexLengthString.substring(0, 2), 16),
      parseInt(hexLengthString.substring(2, 4), 16),
      ...paddedArray,
    ]);

    Reactotron.log('finalByteArray', finalByteArray);

    let temparray;
    const chunk = 20;
    const promises = [];
    Reactotron.log(this.base64ArrayBuffer(finalByteArray));

    for (let i = 0; i < finalByteArray.length; i += chunk) {
      temparray = finalByteArray.slice(i, i + chunk);
      str = this.base64ArrayBuffer(temparray);
      Reactotron.log(`Chunk #${(i + chunk) / chunk}`, str);
      promises.push(characteristic.writeWithoutResponse(str));
    }

    await Promise.all(promises);
    Reactotron.log('Sent proto data');
    this.setState({ waitingForDevice: true });
  };

  base64ArrayBuffer = arrayBuffer => {
    let base64 = '';
    const encodings =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

    const bytes = new Uint8Array(arrayBuffer);
    const { byteLength } = bytes;
    const byteRemainder = byteLength % 3;
    const mainLength = byteLength - byteRemainder;

    let a;
    let b;
    let c;
    let d;
    let chunk;

    // Main loop deals with bytes in chunks of 3
    for (let i = 0; i < mainLength; i += 3) {
      // Combine the three bytes into a single integer
      chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];

      // Use bitmasks to extract 6-bit segments from the triplet
      a = (chunk & 16515072) >> 18; // 16515072 = (2^6 - 1) << 18
      b = (chunk & 258048) >> 12; // 258048   = (2^6 - 1) << 12
      c = (chunk & 4032) >> 6; // 4032     = (2^6 - 1) << 6
      d = chunk & 63; // 63       = 2^6 - 1

      // Convert the raw binary segments to the appropriate ASCII encoding
      base64 += encodings[a] + encodings[b] + encodings[c] + encodings[d];
    }

    // Deal with the remaining bytes and padding
    if (byteRemainder == 1) {
      chunk = bytes[mainLength];

      a = (chunk & 252) >> 2; // 252 = (2^6 - 1) << 2

      // Set the 4 least significant bits to zero
      b = (chunk & 3) << 4; // 3   = 2^2 - 1

      base64 += `${encodings[a] + encodings[b]}==`;
    } else if (byteRemainder == 2) {
      chunk = (bytes[mainLength] << 8) | bytes[mainLength + 1];

      a = (chunk & 64512) >> 10; // 64512 = (2^6 - 1) << 10
      b = (chunk & 1008) >> 4; // 1008  = (2^6 - 1) << 4

      // Set the 2 least significant bits to zero
      c = (chunk & 15) << 2; // 15    = 2^4 - 1

      base64 += `${encodings[a] + encodings[b] + encodings[c]}=`;
    }

    return base64;
  };

  base64ToBase16 = base64 =>
    CustomBase64.atob(base64)
      .split('')
      .map(function(aChar) {
        return `0${aChar.charCodeAt(0).toString(16)}`.slice(-2);
      })
      .join('')
      .toUpperCase(); // Per your example output

  startMonitoring = async () => {
    const characteristic = this.state.characteristics.find(
      char => char.isNotifiable
    );
    Reactotron.log('Attempting to monitor: ', characteristic);
    if (!characteristic) {
      alert("Can't monitor on BLE");
    }
    characteristic.monitor((error, characteristic) => {
      if (error) {
        alert(error);
        this.setState({ characteristics: null, waitingForDevice: false });
      } else {
        Reactotron.log('Received msg', characteristic.value);
        if (Base64.decode(characteristic.value) == 'y') {
          this.setState({ hardwareConfirmed: true });
          this.sendPressed();
          this.setState({ waitingForDevice: false });
        } else if (Base64.decode(characteristic.value) == 'x') {
          this.setState({ hardwareConfirmed: false });
          this.resetToBalance();
        }
      }
    });
  };

  // startMonitoring = async () => {
  //     let characteristic = this.state.characteristics.find(char => char.isNotifiable);
  //     Reactotron.log('Monitoring characteristic: ', characteristic);
  //     alert("Monitoring Characteristic #" + characteristic.id + " : " + characteristic.uuid);
  //     characteristic.monitor((error, characteristic) => {
  //       if (error) {
  //         alert(error)
  //       } else {
  //         let timeStamp = new Date().toLocaleTimeString();
  //         let messageVal = Base64.decode(characteristic.value);
  //         let message =  "Received " + messageVal + "  => @" + timeStamp;
  //         this.pushReceivedMessage(message);
  //       }
  //     })
  //   }

  waitForHardwareData = async (sighashes, walletPath) => {
    const {
      hardwareDataReceived,
      hardwareData,
      unsignedTransactionResponse,
    } = this.state;
    const { tb, orderedUtxos } = unsignedTransactionResponse;
    const signatures = [];
    if (hardwareDataReceived) {
      Reactotron.log(hardwareData);
      alert(hardwareData);
      // TODO Receive signatures correctly from Hardware
      // let r_s = hardwareData.split(';');

      // If HW is sending R and S separately
      // let rsArray = [];
      // for (let sigCounter in r_s) {
      // let r_and_s = r_s[sigCounter].split(',');
      //     let r = r_s[0],
      //         s = r_s[1];
      //     let sig = r + s;
      //     rsArray.push(sig);
      // }

      // sighashes = sighashes.split(',');
      // // Get pubkey for each path of tx
      // let paths = walletPath.split(',');
      // for (let i in paths) {
      //     let tempSigObj = {};
      //     tempSigObj.sighash = sighashes[i];
      //     tempSigObj.path = paths[i];
      //     Reactotron.log(tempSigObj);
      //     tempSigObj.pubkey = wallet.getPubkeyAtDerivationPath(paths[i]);
      //     // tempSigObj.signature = r_s[i];
      //     Reactotron.log(tempSigObj);
      //     // Sign in app FIXME: receive sigs from HW
      //     let p2pkh = bitcoin.payments.p2pkh({ pubkey: tempSigObj.pubkey });
      //     tempSigObj.signature = bitcoin.script.signature.decode(p2wpkh.signature);
      //     Reactotron.log(tempSigObj);

      //     signatures[i].push(tempSigObj);
      // }

      // Sample Signatures array should look like this
      //     signatures = [
      //         {
      //             path: 'm/44/1/1/0/0',
      //             pubkey: '030d03dad931aad07d4bff0979b9d4b15a565e6928dcd0af8482c38dd84c6dce9a',
      //             sighash: '6510d970ec50c18b945fbd4894cfedd656146476b5a9b67e4e673ab9eb0f7bd6',
      //             signature: '7443566c620d3f9ebc15188357abbe52221fb4553ee29bb9a1f81c80f2e1c5af470e41c6e556324ab0d757dc7b02c95976c338220fa6bdfff44699d96b169581'
      //         },
      //         {
      //             path: 'm/44/1/1/0/1',
      //             pubkey: '03d96a88a10a440eb3749eea49106092fcf27bab0646909ac019bb03dd048db0d4',
      //             sighash: '2cce7868275f370cb19001f84a0369776550c584e1200f11762de1c421737fae',
      //             signature: 'c3ff1664172a192df200324ea54144b9222484ba1e02bb8d9c636814d37f607117a8d78050f932c89694ffc01808497571a8a456b722243b018923d2be38744c'
      //         }
      //     ]
      // );

      // let signedTx = await transaction.signBuildTransaction(tb, orderedUtxos, signatures);
      // let hex = signedTx.tb.build().toHex();
      // Reactotron.log(signedTx, hex)
      // await NetworkManager.broadcastTransaction(hex);
    }
  };

  getSigsFromApp = () => {
    const { unsignedTransactionResponse } = this.state;
    const { tb, orderedUtxos, sighashes } = unsignedTransactionResponse;
    const signatures = [];
    Reactotron.log(unsignedTransactionResponse);

    for (const sighashObj of sighashes) {
      Reactotron.log(sighashObj);
      sighashObj.pubkey = wallet.getPubkeyAtDerivationPath(sighashObj.path);
      Reactotron.log(sighashObj);
      // Sign in app FIXME: receive sigs from HW
      const p2pkh = bitcoin.payments.p2pkh({ pubkey: tempSigObj.pubkey });
      Reactotron.log(p2pkh);
      sighashObj.signature = bitcoin.script.signature.decode(p2pkh.signature);
      Reactotron.log(sighashObj);
    }

    // Sample Signatures array should look like this
    //     signatures = [
    //         {
    //             path: 'm/44/1/1/0/0',
    //             pubkey: '030d03dad931aad07d4bff0979b9d4b15a565e6928dcd0af8482c38dd84c6dce9a',
    //             sighash: '6510d970ec50c18b945fbd4894cfedd656146476b5a9b67e4e673ab9eb0f7bd6',
    //             signature: '7443566c620d3f9ebc15188357abbe52221fb4553ee29bb9a1f81c80f2e1c5af470e41c6e556324ab0d757dc7b02c95976c338220fa6bdfff44699d96b169581'
    //         },
    //         {
    //             path: 'm/44/1/1/0/1',
    //             pubkey: '03d96a88a10a440eb3749eea49106092fcf27bab0646909ac019bb03dd048db0d4',
    //             sighash: '2cce7868275f370cb19001f84a0369776550c584e1200f11762de1c421737fae',
    //             signature: 'c3ff1664172a192df200324ea54144b9222484ba1e02bb8d9c636814d37f607117a8d78050f932c89694ffc01808497571a8a456b722243b018923d2be38744c'
    //         }
    //     ]
    // );

    // let signedTx = await transaction.signBuildTransaction(tb, orderedUtxos, signatures);
    // let hex = signedTx.tb.build().toHex();
    // Reactotron.log(signedTx, hex)
    // await NetworkManager.broadcastTransaction(hex);
  };

  // Use this header to work with HW BLE
  renderBLEHeader = () => (
    <View style={style.nameContainer}>
      <View>
        <Text style={style.deviceTitleText}>lastbit Go</Text>
        <ThemeConsumer>
          {themeObj => {
            if (this.state.characteristics == null) {
              return (
                <TouchableOpacity
                  style={style.subTitleButton}
                  onPress={() => this.connectToGO()}
                >
                  <Icon
                    name="bluetooth"
                    size={12}
                    style={{ marginTop: 4, marginRight: 4 }}
                    color={themeObj.theme.COLOR_INFO}
                  />
                  <Text
                    style={{
                      ...style.deviceSubtitleText,
                      color: themeObj.theme.COLOR_INFO,
                    }}
                  >
                    Connect to lastbit Go
                  </Text>
                </TouchableOpacity>
              );
            }
            return (
              <TouchableOpacity
                style={style.subTitleButton}
                onPress={() => this.disconnectFromGo()}
              >
                <Icon
                  name="bluetooth-connected"
                  size={12}
                  style={{ marginTop: 4, marginRight: 4 }}
                  color="darkgreen"
                />
                <Text
                  style={{ ...style.deviceSubtitleText, color: 'darkgreen' }}
                >
                  Connected to lastbit Go
                </Text>
              </TouchableOpacity>
            );
          }}
        </ThemeConsumer>
      </View>
    </View>
  );

  renderHeader = () => (
    <View style={[style.nameContainer, { padding: 20, height: 80 }]}>
      <View>
        <Text style={style.deviceTitleText}>lastbit Go</Text>
        <ThemeConsumer>
          {themeObj => {
            if (!this.state.walletBackedUp) {
              return (
                <TouchableOpacity
                  style={style.subTitleButton}
                  onPress={() => {
                    Mixpanel.track('Home Backup Wallet Pressed');
                    this.props.navigation.navigate('SettingsScreen', {
                      executeSetting: 'backup',
                    });
                  }}
                >
                  <Ionicons
                    name="ios-warning"
                    size={12}
                    style={{ marginTop: 4 }}
                    color={themeObj.theme.COLOR_WARNING}
                  />
                  <Text
                    style={{
                      ...style.deviceSubtitleText,
                      color: themeObj.theme.COLOR_WARNING,
                    }}
                  >{` ${this.context.translate('notBackedupWarn')}`}</Text>
                </TouchableOpacity>
              );
            }
            return (
              <TouchableOpacity
                style={style.subTitleButton}
                onPress={this.displayWarningInfo}
              >
                <Ionicons
                  name="ios-information-circle-outline"
                  size={12}
                  style={{ marginTop: 4 }}
                />
                <Text
                  style={style.deviceSubtitleText}
                >{` ${this.context.translate('keysOnMobile')}`}</Text>
              </TouchableOpacity>
            );
          }}
        </ThemeConsumer>
      </View>
    </View>
  );

  renderActionButtons = () => {
    const { translate } = this.context;
    const { broadcastingTx } = this.state;
    return (
      <View style={style.actionButtonContainer}>
        {(this.state.viewMode === 'balance' ||
          this.state.viewMode === 'send') &&
          this.state.qrCodeScannerVisible === false &&
          !broadcastingTx && (
            <TouchableOpacity
              style={style.actionButton}
              onPress={this.sendPressed}
            >
              <Image
                style={style.buttonImage}
                source={require('../../../assets/images/send.png')}
              />
              <Text style={style.buttonText}>{translate('send')}</Text>
            </TouchableOpacity>
          )}

        {this.state.viewMode === 'balance' && (
          <View style={style.centerActionButton}>
            <TouchableOpacity
              style={{ alignItems: 'center' }}
              onPress={this.marketsPressed}
            >
              <Image
                style={style.buttonImage}
                source={require('../../../assets/images/btc_price.png')}
              />
              <Text style={style.buttonText}>{translate('markets')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {this.state.viewMode === 'balance' && (
          <TouchableOpacity
            style={style.actionButton}
            onPress={this.receivePressed}
          >
            <Image
              style={style.buttonImage}
              source={require('../../../assets/images/receive.png')}
            />
            <Text style={style.buttonText}>{translate('receive')}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  renderSendView = () => {
    const { translate, theme } = this.context;
    const { recommendedFee } = this.state;
    return (
      <View style={{ padding: 20 }}>
        <View style={style.sendHeader}>
          <TouchableOpacity
            style={style.backImageContainer}
            onPress={this.sendViewBackButtonPressed}
          >
            <Image
              style={style.backImage}
              source={require('../../../assets/images/back.png')}
            />
          </TouchableOpacity>
          <View>
            <Text style={style.deviceTitleText}>
              {translate('sendBTCTitle')}
            </Text>
            <UnitConsumer>
              {coinUnitObj => (
                <TouchableOpacity onPress={() => coinUnitObj.cycleUnits()}>
                  <Text style={style.deviceSubtitleText}>
                    {translate('available')}:{' '}
                    {
                      coinUnitObj.unitConverter(
                        this.state.currentBalanceSatoshis
                      ).nonSciString
                    }
                  </Text>
                </TouchableOpacity>
              )}
            </UnitConsumer>
          </View>
          <TouchableOpacity
            style={style.scanCodeTouchable}
            onPress={() => {
              Mixpanel.track('Home Send QR Scan Pressed');
              LayoutAnimation.configureNext(CustomLayoutAnimation(200));
              this.setState({
                qrCodeScannerVisible: !this.state.qrCodeScannerVisible,
              });
            }}
          >
            <Image
              style={style.qrImage}
              source={require('../../../assets/images/qrscan.png')}
            />
          </TouchableOpacity>
        </View>
        {this.state.unsignedTransactionResponse !== null &&
        !this.state.broadcastingTx ? (
          <UnitConsumer>
            {coinUnitObj => (
              <View style={style.sendTextInputContainer}>
                <View style={{ flexDirection: 'row' }}>
                  <Text style={style.transactionsDetailText}>{`${translate(
                    'amount'
                  )}: `}</Text>
                  <Text
                    style={{
                      ...style.transactionsDetailText,
                      color: `${theme.PRIMARY_COLOR}`,
                    }}
                  >
                    {`${
                      coinUnitObj.unitConverter(this.state.sendAmount)
                        .nonSciString
                    } ${
                      this.context.unit.displayName !== 'Satoshis'
                        ? ` (${this.state.sendAmount} sats)`
                        : ` (${Math.round(this.state.sendAmount) /
                            100000000} BTC)`
                    }`}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row' }}>
                  <Text style={style.transactionsDetailText}>{`${translate(
                    'toAddr'
                  )}: `}</Text>
                  <Text
                    style={{
                      ...style.transactionsDetailText,
                      color: `${theme.PRIMARY_COLOR}`,
                      flex: 1,
                    }}
                  >
                    {this.state.sendAddress}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row' }}>
                  <Text style={style.transactionsDetailText}>{`${translate(
                    'fees'
                  )}: `}</Text>
                  <Text
                    style={{
                      ...style.transactionsDetailText,
                      color: `${theme.PRIMARY_COLOR}`,
                    }}
                  >
                    {`${
                      coinUnitObj.unitConverter(
                        this.state.unsignedTransactionResponse.fee
                      ).nonSciString
                    } ${
                      this.context.unit.displayName !== 'Satoshis'
                        ? ` (${this.state.unsignedTransactionResponse.fee} sats)`
                        : ` (${Math.round(
                            this.state.unsignedTransactionResponse.fee
                          ) / 100000000} BTC)`
                    }`}
                  </Text>
                </View>
              </View>
            )}
          </UnitConsumer>
        ) : this.state.broadcastingTx ? (
          <View
            style={{ ...style.sendTextInputContainer, alignItems: 'center' }}
          >
            <View style={{ flexDirection: 'row' }}>
              <ActivityIndicator color="black" />
            </View>
            <View style={{ flexDirection: 'row' }}>
              <Text style={style.transactionsDetailText}>{`${translate(
                'paymentInProgress'
              )}...`}</Text>
            </View>
          </View>
        ) : this.state.qrCodeScannerVisible === true ? (
          <View
            style={{
              height: Dimensions.get('window').height,
              width: '100%',
              marginTop: 20,
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
        ) : (
          <View style={style.sendTextInputContainer}>
            <View style={style.textInlineBtnContainer}>
              <TextInput
                onChangeText={text => this.setState({ sendAddress: text })}
                value={this.state.sendAddress}
                autoCapitalize="none"
                style={{ ...style.sendTextInput, flex: 5 }}
                autoCorrect={false}
                returnKeyType="done"
                placeholder={`${translate('recipient')} ${translate(
                  'address'
                )}`}
              />
              <TouchableOpacity
                style={style.inlineBtn}
                onPress={async () =>
                  this.setState({ sendAddress: await Clipboard.getString() })
                }
              >
                <Image
                  style={style.pasteImage}
                  source={require('../../../assets/images/paste.png')}
                />
              </TouchableOpacity>
            </View>
            <View style={style.textInlineBtnContainer}>
              <TextInput
                value={this.state.sendAmount}
                onChangeText={text =>
                  this.setState({ sendAmount: text.replace(/,/, '.') })
                }
                style={{ ...style.sendTextInput, flex: 5 }}
                placeholder={`${translate('enterAmount')} (${
                  this.context.unit.displayName
                })`}
                keyboardType="decimal-pad"
                returnKeyType="done"
              />
              <TouchableOpacity style={style.inlineBtn} onPress={this.sendMax}>
                <Text>{translate('max')}</Text>
              </TouchableOpacity>
            </View>
            {this.state.feePickerVisible == false ? (
              <TouchableOpacity
                style={{ alignItems: 'flex-end' }}
                onPress={() => this.setState({ feePickerVisible: true })}
              >
                <Text style={style.feeText}>
                  {`${translate('fees')}: ${
                    this.state.selectedFee
                  } satoshis/byte`}
                  <Text
                    style={{
                      ...style.feeText,
                      color: `${theme.PRIMARY_COLOR}`,
                    }}
                  >{` (${translate('change')})`}</Text>
                </Text>
              </TouchableOpacity>
            ) : (
              <>
                <Slider
                  style={{
                    width: 250,
                    height: 40,
                    alignSelf: 'center',
                    marginTop: 10,
                  }}
                  minimumValue={1}
                  maximumValue={
                    recommendedFee.defaultFee
                      ? recommendedFee.defaultFee
                      : recommendedFee.fastestFee
                  }
                  minimumTrackTintColor={this.context.theme.COLOR_INFO}
                  maximumTrackTintColor="#000000"
                  onValueChange={value => {
                    Reactotron.log(value);
                    this.setState({ selectedFee: value });
                  }}
                  step={1}
                  value={this.state.selectedFee}
                />
                <Text
                  style={{
                    fontFamily: 'Quicksand-Medium',
                    color: theme.MUTED_COLOR,
                    fontSize: 15,
                    marginTop: 10,
                    textAlign: 'center',
                  }}
                >
                  {`${translate('fees')}: ${
                    this.state.selectedFee
                  } satoshis/byte`}
                </Text>
              </>
            )}
          </View>
        )}
        {this.state.waitingForDevice ? (
          <Modal
            visible={this.props.visible}
            transparent
            animationType="fade"
            onRequestClose={() => this.setState({ waitingForDevice: false })}
          >
            <View
              style={{
                backgroundColor: 'rgba(0,0,0,0.9)',
                flex: 1,
                padding: 20,
                paddingTop: 10,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <View style={{ flex: 2 }}>
                <Text
                  style={{
                    color: 'white',
                    fontSize: 18,
                    textAlign: 'center',
                    marginTop: 60,
                  }}
                >
                  {translate('deviceTxTitle')}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <ActivityIndicator
                  color="white"
                  size="large"
                  style={{ marginTop: 40 }}
                />
              </View>
              <View style={{ flex: 2 }}>
                <Text
                  style={{ color: 'white', fontSize: 14, marginTop: 10 }}
                >{`${translate('waitingForSigs')}...`}</Text>
                <TouchableOpacity
                  style={{ marginTop: 40, borderWidth: 0 }}
                  onPress={() => this.resetToBalance()}
                >
                  <Text
                    style={{
                      color: 'orange',
                      textAlign: 'center',
                      marginTop: 10,
                    }}
                  >
                    {translate('cancelPayment')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        ) : null}
      </View>
    );
  };

  renderReceiveView = () => {
    const address = bip21.encode(this.state.receivingAddress);
    const { translate } = this.context;
    return (
      <View style={{ padding: 20 }}>
        <View style={style.sendHeader}>
          <TouchableOpacity
            style={style.backImageContainer}
            onPress={this.resetToBalance}
          >
            <Image
              style={style.backImage}
              source={require('../../../assets/images/back.png')}
            />
          </TouchableOpacity>
          <View>
            <Text style={style.deviceTitleText}>
              {translate('receiveBTCTitle')}
            </Text>
            <Text style={style.deviceSubtitleText}>
              {translate('receiveBTCSubtitle')}
            </Text>
          </View>
        </View>
        <View style={style.receiveQRContainer}>
          <View style={{ marginVertical: 20 }}>
            <QRCode value={address} size={240} />
          </View>
          <Text style={style.scanCodeText}>{this.state.receivingAddress}</Text>
          <View
            style={{ flexDirection: 'row', justifyContent: 'space-evenly' }}
          >
            <TouchableOpacity
              style={{ ...style.shareLinkTouchable, marginRight: 10 }}
              onPress={() => {
                Mixpanel.track('Home Receive Shared LInk Pressed');

                Share.share({
                  message: address,
                });
              }}
            >
              <Text style={style.sharePaymentLinkText}>
                {translate('sharePaymentLink')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ ...style.shareLinkTouchable, marginLeft: 10 }}
              onPress={() => {
                Mixpanel.track('Home Receive Address Copy');
                Clipboard.setString(this.state.receivingAddress);
                window.EventBus.trigger('showDropdownAlert', {
                  type: 'info',
                  title: 'Address copied!',
                  message:
                    'Your current address has been copied to your clipboard.',
                });
              }}
            >
              <Text style={style.sharePaymentLinkText}>
                {translate('copyAddress')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  renderMarkets = () => {
    let currency = { name: 'USD', symbol: '$' };
    if (this.context.unit.conversionName == 'fiat') {
      currency = {
        name: this.context.unit.displayName,
        symbol: this.context.unit.symbol,
      };
    }
    return (
      <View style={{ flex: 1 }}>
        <PriceChartViewer
          onBackPressed={() => {
            LayoutAnimation.configureNext(CustomLayoutAnimation(200));

            this.props.handleSwipeGesture(true);
            this.setState({ viewMode: 'balance' });
          }}
          coin="BTC"
          coinName="Bitcoin"
          coinPrice={this.state.currentPrice}
          coinDelta={this.state.coinDelta}
          currency={currency}
          homescreenstyle={style}
          receivingAddress={this.state.receivingAddress}
        />
      </View>
    );
  };

  renderActiveWalletActionView = () => (
    <View
      style={{
        ...style.headerContentContainer,
        flex:
          this.state.viewMode === 'portfolio' ||
          this.state.viewMode === 'markets'
            ? 1
            : undefined,
        padding: 0,
      }}
    >
      {this.state.viewMode === 'balance' && this.renderHeader()}
      {this.state.viewMode === 'balance' && this.renderBalanceContainer()}
      {this.state.viewMode === 'send' && this.renderSendView()}
      {this.state.viewMode === 'receive' && this.renderReceiveView()}
      {this.state.viewMode === 'portfolio' && this.renderPortfolio()}
      {this.state.viewMode === 'markets' && this.renderMarkets()}
      {this.state.currentBalanceSatoshis !== null &&
        (this.state.viewMode === 'send' || this.state.viewMode === 'balance') &&
        this.renderActionButtons()}
    </View>
  );

  renderTransactionPopupView = () => {
    const { translate } = this.context;
    if (this.state.selectedTransaction) {
      Mixpanel.trackWithProperties('Home Transaction Selected', {
        txID: this.state.selectedTransaction.txid,
      });
    }
    return (
      <Modal
        visible={this.state.selectedTransaction !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          this.setState({ selectedTransaction: null });
        }}
      >
        {this.state.selectedTransaction && (
          <View style={style.transactionPopupContainer}>
            <View style={style.transactionPopupContentContainer}>
              <SafeAreaView>
                <View style={{ ...style.sendHeader, marginBottom: 20 }}>
                  <TouchableOpacity
                    style={style.backImageContainer}
                    onPress={() => this.setState({ selectedTransaction: null })}
                  >
                    <Image
                      style={style.backImage}
                      source={require('../../../assets/images/back.png')}
                    />
                  </TouchableOpacity>
                  <View>
                    <Text style={style.deviceTitleText}>
                      {translate('txDetails')}
                    </Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row' }}>
                  <Text style={style.transactionsDetailText}>{`${translate(
                    'type'
                  )}: `}</Text>
                  <Text
                    style={{
                      ...style.transactionsDetailText,
                      color: `${this.context.theme.PRIMARY_COLOR}`,
                      flex: 1,
                    }}
                  >
                    {this.state.selectedTransaction.type}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row' }}>
                  <Text style={style.transactionsDetailText}>{`${translate(
                    'id'
                  )}: `}</Text>
                  <Text
                    style={{
                      ...style.transactionsDetailText,
                      color: `${this.context.theme.PRIMARY_COLOR}`,
                      flex: 1,
                    }}
                  >
                    {this.state.selectedTransaction.txid}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row' }}>
                  <Text style={style.transactionsDetailText}>{`${translate(
                    'time'
                  )}: `}</Text>
                  <Text
                    style={{
                      ...style.transactionsDetailText,
                      color: `${this.context.theme.PRIMARY_COLOR}`,
                      flex: 1,
                    }}
                  >
                    {this.state.selectedTransaction.time
                      ? moment
                          .unix(this.state.selectedTransaction.time)
                          .format('MMM Do[,] YYYY HH[:]mm')
                      : 'Unconfirmed'}
                  </Text>
                </View>
                <UnitConsumer>
                  {coinUnitObj => {
                    const btcamt =
                      this.context.unit.displayName === 'Satoshis'
                        ? `BTC ${Math.round(
                            this.state.selectedTransaction.amount
                          ) / 100000000}`
                        : `${this.state.selectedTransaction.amount} sats`;
                    const msg = `${btcamt} (${
                      coinUnitObj.unitConverter(
                        this.state.selectedTransaction.amount
                      ).nonSciString
                    })`;
                    return (
                      <View style={{ flexDirection: 'row' }}>
                        <Text
                          style={style.transactionsDetailText}
                        >{`${translate('amount')}: `}</Text>
                        <Text
                          style={{
                            ...style.transactionsDetailText,
                            color: `${this.context.theme.PRIMARY_COLOR}`,
                            flex: 1,
                          }}
                        >
                          {`${msg}`}
                        </Text>
                      </View>
                    );
                  }}
                </UnitConsumer>
                <UnitConsumer>
                  {coinUnitObj => {
                    const btcamt =
                      this.context.unit.displayName === 'Satoshis'
                        ? `BTC ${Math.round(
                            this.state.selectedTransaction.fees
                          ) / 100000000}`
                        : `${this.state.selectedTransaction.fees} sats`;
                    const msg = `${btcamt} (${
                      coinUnitObj.unitConverter(
                        this.state.selectedTransaction.fees
                      ).nonSciString
                    })`;
                    return (
                      <View style={{ flexDirection: 'row' }}>
                        <Text
                          style={style.transactionsDetailText}
                        >{`${translate('fees')}: `}</Text>
                        <Text
                          style={{
                            ...style.transactionsDetailText,
                            color: `${this.context.theme.PRIMARY_COLOR}`,
                            flex: 1,
                          }}
                        >
                          {msg}
                        </Text>
                      </View>
                    );
                  }}
                </UnitConsumer>
                <View style={{ flexDirection: 'row' }}>
                  <Text style={style.transactionsDetailText}>{`${translate(
                    'confs'
                  )}: `}</Text>
                  <Text
                    style={{
                      ...style.transactionsDetailText,
                      color: `${this.context.theme.PRIMARY_COLOR}`,
                      flex: 1,
                    }}
                  >
                    {this.state.selectedTransaction.confirmations
                      ? this.state.selectedTransaction.confirmations
                      : '0'}
                  </Text>
                </View>
                {this.state.selectedTransaction.type !== 'self' && (
                  <View style={{ flexDirection: 'row' }}>
                    <Text style={style.transactionsDetailText}>
                      {this.state.selectedTransaction.type === 'send'
                        ? `${translate('recipient')}: `
                        : `${translate('sender')}: `}
                    </Text>
                    <Text
                      style={{
                        ...style.transactionsDetailText,
                        color: `${this.context.theme.PRIMARY_COLOR}`,
                        flex: 1,
                      }}
                    >
                      {this.state.selectedTransaction.addresses[0]}
                    </Text>
                  </View>
                )}
                <View style={{ flexDirection: 'row-reverse' }}>
                  <TouchableOpacity
                    style={style.shareLinkTouchable}
                    onPress={() => {
                      Linking.openURL(
                        config.bitcoinNetwork === bitcoin.networks.testnet
                          ? `${config.blockExplorerTestNetURL +
                              this.state.selectedTransaction.txid}/`
                          : `${config.blockExplorerMainNetURL +
                              this.state.selectedTransaction.txid}/`
                      );
                    }}
                  >
                    <Text style={style.sharePaymentLinkText}>
                      {translate('viewOnBlkExp')}
                    </Text>
                  </TouchableOpacity>
                  <View style={{ flex: 1 }} />
                </View>
              </SafeAreaView>
            </View>
          </View>
        )}
      </Modal>
    );
  };

  renderTransactionRow = ({ item, index }) => (
    <TransactionRow
      transaction={item}
      index={index}
      onSelect={transaction =>
        this.setState({ selectedTransaction: transaction })
      }
    />
  );

  renderTransaction = () => (
    <View style={style.transactionsContainer}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          {this.state.broadcastedPendingTransactions.length > 0 && (
            <View style={{ backgroundColor: '#FF9900', padding: 20 }}>
              <Text
                style={{
                  fontFamily: 'Quicksand-Medium',
                  fontSize: 15,
                  color: 'white',
                }}
              >
                Propagating transaction...
              </Text>
              <Text
                style={{
                  fontFamily: 'Quicksand-Regular',
                  fontSize: 12,
                  color: 'white',
                }}
              >
                Your balance may appear incorrectly during this time. This
                process usually does not take more than a minute.
              </Text>
            </View>
          )}
          {this.state.transactions ? (
            <FlatList
              refreshControl={
                <RefreshControl
                  colors={[`${this.context.theme.COLOR_INFO}`]}
                  onRefresh={() => {
                    this.fetchUTXOs();
                    this.getLatestPrice();
                  }}
                  refreshing={this.state.refreshingTransactions}
                />
              }
              data={this.state.transactions}
              keyExtractor={(item, index) => `${index}`}
              renderItem={this.renderTransactionRow}
            />
          ) : (
            <View style={style.emptyTransactionContainer}>
              <ActivityIndicator
                color={`${this.context.theme.PRIMARY_COLOR}`}
              />
              <Text
                style={{ ...style.transactionTimeText, marginTop: 20 }}
              >{`${this.context.translate('fetchingTxs')}...`}</Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );

  render() {
    const flexStyle = {
      flex:
        this.state.viewMode === 'portfolio' || this.state.viewMode === 'markets'
          ? 1
          : undefined,
    };
    return (
      <ThemeConsumer>
        {themeObj => {
          style = themeObj.createStyle(generateStyleSheet, 'Home');
          return (
            <View style={style.containerView}>
              <StatusBar barStyle="light-content" />
              {this.renderTransactionPopupView()}
              <SafeAreaView style={[style.safeContainer, flexStyle]}>
                {this.renderActiveWalletActionView(themeObj.changeTheme)}
              </SafeAreaView>
              {this.state.viewMode === 'balance' && this.renderTransaction()}
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
        <HomeScreen
          {...this.props}
          handleSwipeGesture={this.handleSwipeGesture}
        />
      </ProvideCombinedContext>
    );
  }
}
