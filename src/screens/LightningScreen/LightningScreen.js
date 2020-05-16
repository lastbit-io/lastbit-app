import React, { Component } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  Image,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  LayoutAnimation,
  Clipboard,
  Alert,
  Linking,
  RefreshControl,
  BackHandler,
  Modal,
  Dimensions,
  Share,
  AppState,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import LightningManager from 'lightning-manager';
import { VictoryBar, VictoryStack, VictoryLabel } from 'victory-native';
import Reactotron from 'reactotron-react-native';
import { Sentry } from 'react-native-sentry';
import Mixpanel from 'react-native-mixpanel';
import TransactionRow from 'transaction-row';
import AddLightningFunds from 'add-lightning-funds';
import ReceiveLightningPayment from 'receive-lightning-payment';
import { ThemeConsumer } from 'theme-manager';
import { UnitConsumer } from 'unit-manager';
import QRCodeScanner from 'react-native-qrcode-scanner';
import RNLocation from 'react-native-location';
import NetInfo from '@react-native-community/netinfo';
import ProvideCombinedContext, { CombinedContext } from 'state-manager';
import config from 'config';
import bitcoin from 'rn-bitcoinjs-lib';
import bolt11 from 'bolt11';
import moment from 'moment';
import validator from 'validator';
import DropdownAlert from 'react-native-dropdownalert';
import Icon from 'react-native-vector-icons/MaterialIcons';
import PayLightningNearbyScreen from 'PayLightningNearbyScreen';
import reactotron from 'reactotron-react-native';
import generateStyleSheet from './style';
import { CustomLayoutAnimation } from '../../shared/HelpingMethods';

let style = false;

const { width, height } = Dimensions.get('window');

class LightningScreen extends Component {
  static contextType = CombinedContext;

  constructor(props) {
    super(props);
    this.state = {
      transactions: null,
      totalSpendableSatoshis: null,
      availableFunds: 0,
      addFundsModalVisible: false,
      contentMode: 'balance',
      sendBolt11: '',
      invoiceAmount: '',
      invoiceDescription: '',
      invoiceBolt11: '',
      receiveLightningPaymentVisible: false,
      invoiceLabel: '',
      selectedTransaction: null,
      qrScannerVisible: false,
      serverOnline: false,
      lightningNodeName: undefined,
      refreshing: false,
      paymentInProgress: false,
      recipientLastbitID: '',
      invoiceLessAmount: '',
      userLastbitId: '',
      lastbitIdModalVisible: false,
      lnInfoVisible: false,
      hidEdit: false,
      payLightningNearbyVisible: false,
      invoiceRequested: false,
      isConnected: false,
      conversionName: null,
      multiplier: null,
    };

    this.startTrackTimer = this.props.navigation.addListener('didFocus', () => {
      Reactotron.log('didFocus');
      Mixpanel.timeEvent('Lightning Screen Tab');
      const { navigation } = this.props;
      const { params } = navigation.state;
      if (
        params &&
        params.linkAddress &&
        params.linkAmount &&
        params.paymentType === 'lightning'
      ) {
        this.handleDeepLinkingValue(params.linkAddress, params.linkAmount);
      }
    });

    this.endTrackTimer = this.props.navigation.addListener('didBlur', () => {
      Reactotron.log('didBlur');
      Mixpanel.track('Lightning Screen Tab');
    });

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
    const { navigation, screenProps } = this.props;
    const { linkAddress, paymentType, linkAmount } = screenProps;

    this.connectToServer();

    this.subscription = NetInfo.addEventListener(this.handleConnectivityChange);

    AppState.addEventListener('change', this.handleAppStateChange);

    if (linkAddress && paymentType === 'bitcoin') {
      navigation.navigate('HomeScreen');
    }
  }

  componentWillUnmount() {
    this.startTrackTimer && this.startTrackTimer.remove();
    this.endTrackTimer && this.endTrackTimer.remove();
    this.subscription && this.subscription();
    AppState.removeEventListener('change', this.handleAppStateChange);
  }

  handleAppStateChange = nextAppState => {
    if (nextAppState === 'active') {
      setTimeout(() => {
        const { navigation } = this.props;
        const { params } = navigation.state;
        if (
          params &&
          params.linkAddress &&
          params.linkAmount &&
          params.paymentType === 'lightning'
        ) {
          this.handleDeepLinkingValue(params.linkAddress, params.linkAmount);
        }
      }, 200);
    }
  };

  handleDeepLinkingValue = (linkAddress, linkAmount) => {
    const { unitConverter } = this.context;
    this.props.handleSwipeGesture(false);
    if (linkAddress.length < 20) {
      const invoiceLessAmount = Number.isInteger(Number(linkAmount))
        ? `${unitConverter(Number(linkAmount)).nonSciString.split(' ')[0]}`
        : `${
            unitConverter(Number(linkAmount * 100000000)).nonSciString.split(
              ' '
            )[0]
          }`;
      this.setState({
        contentMode: 'send',
        recipientLastbitID: linkAddress,
        invoiceLessAmount: linkAmount ? invoiceLessAmount : 0,
      });
    } else {
      this.setState({
        contentMode: 'send',
        sendBolt11: linkAddress,
      });
    }
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

  handleConnectivityChange = state => {
    this.setState({
      isConnected: state.isConnected,
    });
  };

  connectToServer = async () => {
    const { screenProps } = this.props;
    const { linkAddress, paymentType, linkAmount } = screenProps;
    try {
      const serverOnline = await LightningManager.pingLightningAPI();
      Reactotron.log('serverOnline', serverOnline);
      if (serverOnline) {
        if (linkAddress && paymentType === 'lightning') {
          this.handleDeepLinkingValue(linkAddress, linkAmount);
        }
        screenProps.walletLoading();
        this.setState({ serverOnline });
        this.refresh();
      }
    } catch (err) {
      // error
      Reactotron.log(err);
    }
  };

  refresh = async () => {
    const { isConnected, serverOnline } = this.state;
    if (!isConnected) {
      this.setState({
        serverOnline: false,
        transactions: null,
        totalSpendableSatoshis: null,
      });
      return;
    }

    if (!serverOnline) {
      this.connectToServer();
    }

    this.setState({
      refreshing: true,
      transactions: null,
      totalSpendableSatoshis: null,
    });
    await this.getNodeInfo();
    await this.getUserLastbitId();
    await this.getUserTxs();
    // await this.getUserLightningBalance();
    this.setState({ refreshing: false });
  };

  onBackButtonPressAndroid = () => {
    if (this.state.contentMode !== 'balance') {
      this.resetToBalance();
      return true;
    }
    return false;
  };

  copyUserId = async () => {
    Clipboard.setString(this.state.userLastbitId);
    this.dropdownAlert.alertWithType(
      'info',
      this.context.translate('successCopyTitle'),
      this.context.translate('successCopylastbitIDMsg')
    );
  };

  getNodeInfo = async () => {
    const info = await LightningManager.getInfo();
    Reactotron.display({
      name: 'info',
      preview: 'getNodeInfo',
      value: info,
    });
    if (!info) {
      this.setState({ serverOnline: false });
    } else {
      if (this.state.lightningNodeName === undefined) {
        this.setState({
          lightningNodeName: info.alias,
          max_incoming: info.max_incoming,
          safe_receive: info.safe_receive,
          safe_send: info.safe_send,
          max_outgoing: info.max_outgoing,
        });
      }
      return true;
    }
    return false;
  };

  getUserLastbitId = async () => {
    let userLastbitId = await LightningManager.getHId();
    if (!userLastbitId) {
      userLastbitId = await LightningManager.getUserId();
    }
    Reactotron.log('userID', userLastbitId);
    this.setState({ userLastbitId });
  };

  changeLastbitID = async () => {
    if (!validator.isAlphanumeric(this.state.newLastbitID)) {
      this.dropdownAlert.alertWithType(
        'error',
        this.context.translate('errorSetHIDTitle'),
        this.context.translate('errorInvalidHID')
      );
      return;
    }
    const response = await LightningManager.setHId(this.state.newLastbitID);
    Reactotron.log(response);
    if (response.result == -1) {
      this.dropdownAlert.alertWithType(
        'error',
        this.context.translate('errorSetHIDTitle'),
        this.context.translate('errorDuplicateHID')
      );
    }
    this.getUserLastbitId();
    this.setState({ hidEdit: false });
  };

  getUserTxs = async () => {
    const { translate } = this.context;
    const [
      transfers,
      invoices,
      totalSpendableSatoshis,
    ] = await LightningManager.getTxs();
    Reactotron.log(transfers, invoices, this.state.userLastbitId);
    let transactions = [];

    // TODO: Fix inconsistency in backend
    // Invoices
    if (invoices.length > 0) {
      invoices.forEach(invoice => {
        if (
          invoice.type === 'received_ln' ||
          invoice.destination == this.state.userLastbitId
        ) {
          transactions.push({
            amount: invoice.value, // invoice.value is in satoshis
            time: invoice.created_at,
            type: 'receive',
            label: invoice.label,
            payee: translate('receivedFromLN'),
            status: invoice.ispaid
              ? translate('receivedPayment')
              : translate('unpaidInvoice'),
            description: invoice.description || invoice.memo,
          });
        } else if (invoice.status === 'complete') {
          transactions.push({
            amount: invoice.value, // invoice.value is in satoshis
            time: invoice.created_at,
            type: 'send',
            payee: `${translate('sentToLN')} ${invoice.destination}`,
            status:
              invoice.status == 'complete'
                ? translate('paidInvoice')
                : translate('unpaidInvoice'),
            description: invoice.description || invoice.memo,
          });
        }
      });
    }
    if (transfers.length > 0) {
      transfers.forEach(transfer => {
        transactions.push({
          ...transfer,
          amount: transfer.value,
          category: transfer.category == 'receive' ? 'deposit' : 'withdraw', // transfer was received to node, so app deposited
        });
      });
    }

    if (transactions) {
      transactions = transactions.sort((a, b) => b.time - a.time);
    }

    let sortedTransaction = [];

    transactions.forEach(transaction => {
      if (!transaction.time && transaction.type === 'bitcoind_tx') {
        sortedTransaction = [transaction, ...sortedTransaction];
      } else {
        sortedTransaction = [...sortedTransaction, transaction];
      }
    });

    Reactotron.log(transactions);
    this.setState({ transactions: sortedTransaction, totalSpendableSatoshis });
  };

  // getUserLightningBalance = async () => this.setState({ totalSpendableSatoshis: await LightningManager.getUserBalance() });

  resetToBalance = () => {
    const { navigation } = this.props;
    const { params } = navigation.state;
    if (params && params.linkAddress) {
      navigation.setParams({ linkAddress: null, linkAmount: null });
    }

    if (this.state.qrScannerVisible === true) {
      LayoutAnimation.configureNext(CustomLayoutAnimation(200));
      this.setState({ qrScannerVisible: false });
      return;
    }

    LayoutAnimation.configureNext(CustomLayoutAnimation(200));
    this.props.handleSwipeGesture(true);
    this.setState({
      contentMode: 'balance',
      sendBolt11: '',
      invoiceAmount: '',
      invoiceDescription: '',
      recipientLastbitID: '',
      invoiceLessAmount: '',
    });
  };

  qrCodeScanned = event => {
    const copiedString = event.data.replace('lightning:', '');
    if (copiedString.startsWith('lntb')) {
      this.setState({ sendBolt11: copiedString, qrScannerVisible: false }, () =>
        this.sendButtonPressed()
      );
    } else {
      this.setState({
        recipientLastbitID: copiedString,
        qrScannerVisible: false,
      });
    }
  };

  sendButtonPressed = () => {
    const isConnected = this.handleCheckForNetwork();
    if (!isConnected) {
      return;
    }
    Mixpanel.track('Lightning Send Pay Pressed ');
    const { translate, unitConverter } = this.context;
    LayoutAnimation.configureNext(CustomLayoutAnimation(200));
    this.props.handleSwipeGesture(false);
    if (this.state.contentMode === 'send') {
      if (
        this.state.recipientLastbitID.length < 1 &&
        this.state.sendBolt11.length > 0
      ) {
        try {
          const data = bolt11.decode(this.state.sendBolt11);
          // Reactotron.log(data)

          let description = null;
          const descriptionTag = data.tags.find(
            tag => tag.tagName === 'description'
          );
          if (descriptionTag) {
            description = descriptionTag.data;
          }

          let message = `${translate('amount')}: ${data.satoshis} Satoshis`;
          if (description) {
            message = `${message}\n${translate('description')}: ${description}`;
          }
          if (this.state.totalSpendableSatoshis >= data.satoshis) {
            Alert.alert(`${translate('confirmPayment')}?`, message, [
              {
                text: translate('cancel'),
                style: 'cancel',
              },
              {
                text: translate('confirm'),
                onPress: () => {
                  this.makePayment().done();
                },
              },
            ]);
          } else {
            Mixpanel.track('Lightning Screen Error: Not Enough Balance');
            window.EventBus.trigger('showDropdownAlert', {
              type: 'error',
              title: translate('errNotEnoughBalanceTitle'),
              message: `${translate('errNotEnoughBalanceMsg_1')} ${
                unitConverter(data.satoshis).nonSciString
              } ${translate('errNotEnoughBalanceMsg_2')} ${
                unitConverter(this.state.totalSpendableSatoshis).nonSciString
              }`,
            });
          }
        } catch (error) {
          Sentry.captureException(error);
          window.EventBus.trigger('showDropdownAlert', {
            type: 'error',
            title: translate('invalidInvoice'),
            message: error,
          });
        }
      } else if (this.state.recipientLastbitID.length >= 1) {
        if (!validator.isAlphanumeric(this.state.recipientLastbitID)) {
          window.EventBus.trigger('showDropdownAlert', {
            type: 'error',
            title: this.context.translate('invalidInput'),
            message: this.context.translate('errorInvalidHID'),
          });
          return;
        }
        if (validator.isNumeric(`${this.state.invoiceLessAmount}`)) {
          if (this.context.unit.id == 0) {
            if (!validator.isInt(`${this.state.invoiceLessAmount}`)) {
              Mixpanel.track(
                'Lightning Screen Error: Satoshis are indivisible'
              );
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
            'Lightning Screen Error: Please enter a valid non zero amount'
          );
          window.EventBus.trigger('showDropdownAlert', {
            type: 'error',
            title: translate('invalidInput'),
            message: translate('errInvalidAmount'),
          });
          return;
        }
        this.makeInvoicelessPayment();
      }
    } else {
      if (
        !this.state.totalSpendableSatoshis &&
        this.state.totalSpendableSatoshis === 0
      ) {
        this.props.handleSwipeGesture(true);
        Mixpanel.track(
          'Lightning Screen Error: Please ensure you have a non-zero balance.'
        );
        window.EventBus.trigger('showDropdownAlert', {
          type: 'error',
          title: translate('errNoBalanceTitle'),
          message: translate('errNoBalanceMsg'),
        });
        return;
      }
      this.setState({ contentMode: 'send' });
      LightningManager.getTxs();
    }
  };

  raiseInvoice = async () => {
    const { translate, unitConverter, unit } = this.context;
    let { invoiceAmount, invoiceDescription } = this.state;
    if (!validator.isNumeric(`${invoiceAmount}`)) {
      Mixpanel.track(
        'Lightning Screen Error: Please enter a valid non zero amount'
      );
      window.EventBus.trigger('showDropdownAlert', {
        type: 'error',
        title: translate('invalidInput'),
        message: translate('errInvalidAmount'),
      });
      this.setState({ invoiceRequested: false });
      return;
    }
    // Convert to satoshis before creating invoice
    invoiceAmount =
      unit.conversionName == 'fiat'
        ? Math.round((invoiceAmount / unit.multiplier) * 100000000)
        : Math.round(invoiceAmount * unit.multiplier);
    if (invoiceAmount > 0) {
      // Max because rusty said so https://medium.com/@rusty_lightning/bitcoin-lightning-faq-why-the-0-042-bitcoin-limit-2eb48b703f3
      if (invoiceAmount < 4294967) {
        const invoiceResponse = await LightningManager.addInvoice(
          invoiceAmount,
          invoiceDescription
        );
        Reactotron.log({ invoiceResponse });
        if (invoiceResponse) {
          this.setState({
            invoiceBolt11: invoiceResponse.bolt11,
            invoiceExpiresAt: invoiceResponse.expires_at,
            invoiceLabel: invoiceResponse.label,
            receiveLightningPaymentVisible: true,
          });
        }
      } else {
        Mixpanel.track(
          `Lightning Screen Error: Invoice amount should be less than ${
            unitConverter(4294967).nonSciString
          }`
        );
        window.EventBus.trigger('showDropdownAlert', {
          type: 'error',
          title: translate('errInvoiceTooLargeTitle'),
          message: `${translate('errInvoiceTooLargeMsg')} ${
            unitConverter(4294967).nonSciString
          }`,
        });
        this.setState({ invoiceRequested: false });
      }
    } else {
      Mixpanel.track(
        'Lightning Screen Error: Please submit a valid lightning invoice'
      );
      window.EventBus.trigger('showDropdownAlert', {
        type: 'error',
        title: translate('invalidInvoice'),
        message: translate('promptValidInvoice'),
      });
      this.setState({ invoiceRequested: false });
    }
  };

  // TODO: Handle already paid invoice err
  makePayment = async () => {
    this.setState({ paymentInProgress: true });
    const response = await LightningManager.payInvoice(this.state.sendBolt11);
    Reactotron.log(response);
    if (response.status == 'complete') {
      this.setState({ paymentInProgress: false });
      Mixpanel.trackWithProperties('Lightning Send Success', {
        message: this.context.translate('successPay'),
      });
      window.EventBus.trigger('showDropdownAlert', {
        type: 'success',
        title: `${this.context.translate('successPay')}!`,
        message: response.memo,
      });
      this.refresh();
      this.resetToBalance();
    } else {
      this.setState({ paymentInProgress: false });
      Mixpanel.track('Lightning Screen Error: Cannot Make Payment');
      window.EventBus.trigger('showDropdownAlert', {
        type: 'error',
        title: this.context.translate('errCannotPayTitle'),
        message: response.message,
      });
    }
  };

  makeInvoicelessPayment = () => {
    const { unit, translate } = this.context;
    const amount =
      unit.id > 1
        ? parseFloat(this.state.invoiceLessAmount).toFixed(2)
        : this.state.invoiceLessAmount;
    let amountSats =
      unit.conversionName == 'fiat'
        ? (amount / unit.multiplier) * 100000000
        : amount * unit.multiplier;
    amountSats = Math.round(amountSats);
    // TODO: Translate
    const msg = `You are about to send ${amount} ${unit.symbol} ${
      unit.symbol !== 'sats' ? `(${amountSats} sats)` : ''
    } to ${this.state.recipientLastbitID}.`;
    if (this.state.totalSpendableSatoshis >= amountSats) {
      Alert.alert(`${translate('confirmPayment')}?`, msg, [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Confirm',
          onPress: async () => {
            this.setState({ paymentInProgress: true });
            const response = await LightningManager.payInvoiceless(
              this.state.recipientLastbitID,
              amountSats
            );
            Reactotron.log(response);
            if (response.result == 1) {
              window.EventBus.trigger('showDropdownAlert', {
                type: 'success',
                title: translate('successPay'),
                message: response.payload.memo || '',
              });
              this.refresh();
              this.resetToBalance();
            } else {
              Mixpanel.track('Lightning Screen Error: Payment failed');
              window.EventBus.trigger('showDropdownAlert', {
                type: 'error',
                title: translate('errPayFailed'),
                message: response.message || '',
              });
            }
            this.setState({
              paymentInProgress: false,
              invoiceLessAmount: '',
              recipientLastbitID: '',
            });
          },
        },
      ]);
    } else {
      Mixpanel.track('Lightning Screen Error: Insufficient Balance!');
      window.EventBus.trigger('showDropdownAlert', {
        type: 'error',
        title: translate('errNotEnoughBalanceTitle'),
        message: translate('errPayFailMsg'),
      });
    }
  };

  receiveButtonPressed = () => {
    Mixpanel.track('Lightning Receive Pressed');
    LayoutAnimation.configureNext(CustomLayoutAnimation(200));
    this.props.handleSwipeGesture(false);

    if (this.state.contentMode === 'receive') {
      this.handleCheckLocation('createInvoice');
    } else {
      this.setState({
        contentMode: 'receive',
        conversionName: this.context.unit.conversionName,
        multiplier: this.context.unit.multiplier,
      });
    }
  };

  depositWithdrawPressed = () => {
    LayoutAnimation.configureNext(CustomLayoutAnimation(200));
    this.setState({ addFundsModalVisible: true });
  };

  // --------------Render Methods---------------

  renderBackButton = () => (
    <TouchableOpacity
      style={style.backImageContainer}
      onPress={this.resetToBalance}
    >
      <Image
        source={require('../../../assets/images/back.png')}
        style={style.backImage}
      />
    </TouchableOpacity>
  );

  renderHeader = () => {
    const { translate, theme } = this.context;
    let title = translate('lightningTitle');
    if (this.state.contentMode === 'send') {
      title = translate('sendPayment');
    }

    if (this.state.contentMode === 'receive') {
      title = translate('reqPayment');
    }

    return (
      <View>
        <View style={[style.sendHeader, { padding: 20, height: 80 }]}>
          {(this.state.contentMode === 'send' ||
            this.state.contentMode === 'receive') &&
            this.renderBackButton()}
          <View>
            <Text style={style.deviceTitleText}>{title}</Text>
            {this.state.contentMode === 'balance' ? (
              this.state.serverOnline ? (
                <TouchableOpacity
                  onPress={() => {
                    Mixpanel.track('Lightning Info Visible ');

                    LayoutAnimation.configureNext(CustomLayoutAnimation(200));
                    this.setState({ lnInfoVisible: true });
                  }}
                  disabled={!(this.state.lightningNodeName !== undefined)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                >
                  {this.state.lightningNodeName && (
                    <Icon
                      name="info-outline"
                      size={12}
                      style={{ marginRight: 2 }}
                      color={theme.COLOR_INFO}
                    />
                  )}
                  <Text
                    style={{
                      ...style.deviceSubtitleText,
                      color: `${theme.COLOR_INFO}`,
                    }}
                  >
                    {this.state.lightningNodeName !== undefined
                      ? `${translate('connectedTo')} ${
                          this.state.lightningNodeName
                        }`
                      : `${translate('connecting')}...`}
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text
                  style={{
                    ...style.deviceSubtitleText,
                    color: `${theme.COLOR_ERROR}`,
                  }}
                >
                  {translate('notConnected')}
                </Text>
              )
            ) : this.state.contentMode === 'send' ? (
              <UnitConsumer>
                {coinUnitObj => (
                  <TouchableOpacity onPress={() => coinUnitObj.cycleUnits()}>
                    <Text style={style.deviceSubtitleText}>{`${translate(
                      'available'
                    )}: ${
                      coinUnitObj.unitConverter(
                        this.state.totalSpendableSatoshis
                      ).nonSciString
                    }`}</Text>
                  </TouchableOpacity>
                )}
              </UnitConsumer>
            ) : null}
          </View>
          {this.state.contentMode === 'send' && !this.state.paymentInProgress && (
            <TouchableOpacity
              style={style.scanCodeTouchable}
              onPress={() => {
                Mixpanel.track('Lightning Send Scan Qr Code ');

                LayoutAnimation.easeInEaseOut();
                this.setState({
                  qrScannerVisible: !this.state.qrScannerVisible,
                });
              }}
            >
              <Image
                style={style.qrImage}
                source={require('../../../assets/images/qrscan.png')}
              />
            </TouchableOpacity>
          )}
          {this.state.contentMode === 'balance' &&
            this.state.lightningNodeName !== undefined &&
            this.state.serverOnline && (
              <TouchableOpacity
                style={style.scanCodeTouchable}
                onPress={() => {
                  LayoutAnimation.configureNext(CustomLayoutAnimation(200));
                  this.setState({ lastbitIdModalVisible: true });
                }}
              >
                <Image
                  style={{ ...style.qrImage, tintColor: 'black' }}
                  source={require('../../../assets/images/person.png')}
                />
              </TouchableOpacity>
            )}
        </View>
      </View>
    );
  };

  renderActionButtons = () => {
    const { translate } = this.context;
    if (this.state.serverOnline && this.state.totalSpendableSatoshis != null) {
      return (
        <View
          style={{
            paddingVertical: 10,
            flexDirection: 'row',
            justifyContent: 'space-evenly',
            backgroundColor: 'whitesmoke',
            height: 80,
          }}
        >
          {this.state.contentMode === 'send' &&
            !this.state.paymentInProgress &&
            !this.state.qrScannerVisible &&
            this.state.recipientLastbitID.length < 1 && (
              <TouchableOpacity
                style={style.actionButton}
                onPress={async () => {
                  Mixpanel.track('Lightning Send Paste Pressed ');
                  const copiedString = await Clipboard.getString();
                  if (copiedString.startsWith('lntb')) {
                    this.setState({ sendBolt11: copiedString });
                  } else {
                    this.setState({ recipientLastbitID: copiedString });
                  }
                }}
              >
                <Image
                  style={style.buttonImage}
                  source={require('../../../assets/images/paste.png')}
                />
                <Text style={style.buttonText}>{translate('paste')}</Text>
              </TouchableOpacity>
            )}
          {((this.state.contentMode === 'send' &&
            !this.state.paymentInProgress &&
            !this.state.qrScannerVisible) ||
            this.state.contentMode === 'balance') && (
            <TouchableOpacity
              style={style.actionButton}
              onPress={this.sendButtonPressed}
            >
              <Image
                style={{ ...style.buttonImage, marginVertical: 5 }}
                source={require('../../../assets/images/send.png')}
              />
              <Text style={style.buttonText}>{translate('pay')}</Text>
            </TouchableOpacity>
          )}
          {this.state.contentMode === 'balance' && (
            <View style={style.centerActionButton}>
              <TouchableOpacity
                style={style.actionButton}
                onPress={() => {
                  const isConnected = this.handleCheckForNetwork();
                  if (!isConnected) {
                    return;
                  }
                  Mixpanel.track('Lightning Send Deposit/Withdraw Pressed ');
                  this.depositWithdrawPressed();
                }}
              >
                <Image
                  style={{ ...style.buttonImage, width: 40, height: 40 }}
                  source={require('../../../assets/images/bitcoin_piggy_in.png')}
                />
                <Text style={style.buttonText}>{`${translate(
                  'deposit'
                )}/${translate('withdraw')}`}</Text>
              </TouchableOpacity>
            </View>
          )}
          {((this.state.contentMode === 'receive' &&
            !this.state.invoiceRequested) ||
            this.state.contentMode === 'balance') && (
            <TouchableOpacity
              style={style.actionButton}
              onPress={() => {
                Mixpanel.track('Lightning Send Deposit/Withdraw Pressed ');
                this.receiveButtonPressed();
              }}
            >
              <Image
                style={{ ...style.buttonImage, marginVertical: 5 }}
                source={require('../../../assets/images/receive.png')}
              />
              <Text style={style.buttonText}>{translate('request')}</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }
    return null;
  };

  renderBalanceContainer = () => {
    const { translate, theme } = this.context;
    return (
      <View
        style={{ alignItems: 'center', justifyContent: 'center', height: 100 }}
      >
        {this.state.totalSpendableSatoshis != null ? (
          <UnitConsumer>
            {coinUnitObj => (
              <TouchableOpacity onPress={() => coinUnitObj.cycleUnits()}>
                <Text style={style.balanceTitleText}>
                  {
                    coinUnitObj.unitConverter(this.state.totalSpendableSatoshis)
                      .nonSciString
                  }
                </Text>
              </TouchableOpacity>
            )}
          </UnitConsumer>
        ) : (
          <ActivityIndicator color={theme.PRIMARY_COLOR} />
        )}
        {this.state.serverOnline ? (
          this.state.totalSpendableSatoshis == null ? (
            <Text style={style.balanceSubtitleText}>
              {translate('connecting')}
            </Text>
          ) : this.state.totalSpendableSatoshis == 0 ? (
            <Text style={style.balanceSubtitleText}>
              {translate('emptyLNWallet')}
            </Text>
          ) : (
            <Text style={style.balanceSubtitleText}>
              {translate('lightningSubtitle')}
            </Text>
          )
        ) : (
          <TouchableOpacity
            style={{ flexDirection: 'row' }}
            onPress={() => this.connectToServer()}
          >
            <Text
              style={[
                style.balanceSubtitleText,
                {
                  color: this.context.theme.COLOR_INFO,
                },
              ]}
            >
              {translate('tapToRetryConn')}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  renderSendView = () => (
    <View style={{ paddingHorizontal: 20 }}>
      {this.state.payLightningNearbyVisible && (
        <PayLightningNearbyScreen
          visible={this.state.payLightningNearbyVisible}
          onRequestClose={() =>
            this.setState({ payLightningNearbyVisible: false })
          }
          balance={this.state.totalSpendableSatoshis}
          paymentCompleted={() => {
            this.refresh();
            this.resetToBalance();
            this.setState({ payLightningNearbyVisible: false });
          }}
        />
      )}
      {this.state.qrScannerVisible ? (
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
      ) : !this.state.paymentInProgress ? (
        <View
          style={{
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'stretch',
          }}
        >
          {this.state.recipientLastbitID.length < 1 && (
            <TextInput
              style={[
                style.sendTextInput,
                { width: width - 40, paddingTop: 15 },
              ]}
              placeholder={this.context.translate('enterBolt11')}
              textAlignVertical="top"
              autoCorrect={false}
              autoCapitalize="none"
              value={this.state.sendBolt11}
              onChangeText={text =>
                this.setState({
                  sendBolt11: text
                    .toLowerCase()
                    .split(' ')
                    .join(''),
                })
              }
              multiline
              maxLength={100}
            />
          )}
          <TextInput
            style={[style.sendTextInput, { width: width - 40, paddingTop: 15 }]}
            placeholder={`${this.context.translate(
              'recipientLastbitIDPlaceholder'
            )} (${this.context.translate('optional')})`}
            autoCapitalize="none"
            keyboardType="email-address"
            value={this.state.recipientLastbitID}
            onChangeText={text => this.setState({ recipientLastbitID: text })}
            multiline
            maxLength={100}
          />
          {this.state.recipientLastbitID.length > 0 && (
            <TextInput
              style={{ ...style.sendTextInput }}
              placeholder={`${this.context.translate('enterAmount')} (${
                this.context.unit.displayName
              })`}
              value={this.state.invoiceLessAmount}
              keyboardType="decimal-pad"
              onChangeText={text =>
                this.setState({ invoiceLessAmount: text.replace(/,/, '.') })
              }
            />
          )}
          {/* {this.state.recipientLastbitID.length < 1 && (
                        <TouchableOpacity
                            style={{
                                backgroundColor: 'white',
                                padding: 10,
                                borderColor: 'black',
                                borderWidth: 1,
                            }}
                            onPress={() => {
                                Mixpanel.track('Lightning Make Nearby Payment Pressed ');
                                this.setState({ payLightningNearbyVisible: true });
                            }}
                        >
                            <Text style={{ fontFamily: 'Quicksand-Regular', fontSize: 15 }}>
                                Make Nearby Payment
              </Text>
                        </TouchableOpacity>
                    )} */}
        </View>
      ) : (
        <View style={{ justifyContent: 'center' }}>
          <ActivityIndicator
            size="large"
            color={`${this.context.theme.PRIMARY_COLOR}`}
          />
          <View style={{ alignItems: 'center', marginTop: 20 }}>
            <Text style={style.deviceSubtitleText}>{`${this.context.translate(
              'paymentInProgress'
            )}...`}</Text>
          </View>
        </View>
      )}
    </View>
  );

  renderReceiveView = () => (
    <View style={{ paddingHorizontal: 20 }}>
      <View style={style.textInlineBtnContainer}>
        <UnitConsumer>
          {coinUnitObj => (
            <TouchableOpacity
              style={style.inlineBtn}
              onPress={() => {
                coinUnitObj.cycleUnits();
                setTimeout(() => {
                  if (this.state.invoiceAmount.length > 0) {
                    const amount =
                      this.context.unit.id > 2
                        ? parseFloat(this.state.invoiceAmount).toFixed(2)
                        : this.state.invoiceAmount;
                    let amountSats =
                      this.state.conversionName == 'fiat'
                        ? (amount / this.state.multiplier) * 100000000
                        : amount * this.state.multiplier;
                    reactotron.log('amountSats', amountSats);
                    amountSats = Math.round(amountSats);

                    this.setState({
                      invoiceAmount: `${
                        coinUnitObj
                          .unitConverter(amountSats)
                          .nonSciString.split(' ')[0]
                      }`,
                      conversionName: this.context.unit.conversionName,
                      multiplier: this.context.unit.multiplier,
                    });
                  }
                }, 100);
              }}
            >
              <Text style={style.scanCodeText}>{coinUnitObj.unit.symbol}</Text>
            </TouchableOpacity>
          )}
        </UnitConsumer>
        <TextInput
          style={{ ...style.sendTextInput, flex: 5 }}
          placeholder={`${this.context.translate('enterAmount')} (${
            this.context.unit.displayName
          })`}
          numberOfLines={1}
          autoCorrect={false}
          autoCapitalize="none"
          keyboardType="decimal-pad"
          value={this.state.invoiceAmount}
          onChangeText={text =>
            this.setState({ invoiceAmount: text.replace(/,/, '.') })
          }
        />
      </View>
      <TextInput
        style={{ ...style.sendTextInput, marginTop: 20 }}
        placeholder={`${this.context.translate(
          'description'
        )} (${this.context.translate('optional')})`}
        numberOfLines={1}
        value={this.state.invoiceDescription}
        onChangeText={text => this.setState({ invoiceDescription: text })}
      />
    </View>
  );

  renderAppropriateContent = () => {
    switch (this.state.contentMode) {
      case 'send':
        return this.renderSendView();
      case 'receive':
        return this.renderReceiveView();
      case 'balance':
        return this.renderBalanceContainer();
      default:
        return <View />;
    }
  };

  renderTransactionsList = () => (
    <View style={{ ...style.transactionsContainer }}>
      {this.state.transactions != null && this.state.contentMode === 'balance' && (
        <FlatList
          refreshControl={
            <RefreshControl
              colors={[`${this.context.theme.COLOR_INFO}`]}
              onRefresh={() => this.refresh()}
              refreshing={this.state.refreshing}
            />
          }
          data={this.state.transactions}
          keyExtractor={(item, index) => `${index}`}
          renderItem={({ item, index }) => (
            <TransactionRow
              transaction={item}
              variant="lightning"
              onSelect={() => {
                if (item.type === 'bitcoind_tx') {
                  Mixpanel.trackWithProperties(
                    'Lightning Transaction Selected',
                    {
                      address: item.address,
                    }
                  );
                } else {
                  Mixpanel.trackWithProperties(
                    'Lightning Transaction Selected',
                    {
                      payee: item.payee,
                    }
                  );
                }
                Reactotron.log(item);
                this.setState({ selectedTransaction: item });
              }}
            />
          )}
        />
      )}
    </View>
  );

  renderTransactionPopupView = () => {
    const { translate } = this.context;
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
                {/* // Lightning invoices */}
                {this.state.selectedTransaction.type != 'bitcoind_tx' ? (
                  <View>
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
                        {translate('lnPayment')}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row' }}>
                      <Text style={style.transactionsDetailText}>{`${translate(
                        'category'
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
                        'time'
                      )}: `}</Text>
                      <Text
                        style={{
                          ...style.transactionsDetailText,
                          color: `${this.context.theme.PRIMARY_COLOR}`,
                          flex: 1,
                        }}
                      >
                        {moment
                          .unix(this.state.selectedTransaction.time)
                          .format('MMM Do[,] YYYY HH[:]mm')}
                      </Text>
                    </View>
                    <UnitConsumer>
                      {coinUnitObj => {
                        const satsText =
                          this.context.unit.displayName !== 'Satoshis'
                            ? `${this.state.selectedTransaction.amount} sats`
                            : `${Math.round(
                                this.state.selectedTransaction.amount
                              ) / 100000000} BTC`;
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
                              {`${satsText} (${
                                coinUnitObj.unitConverter(
                                  this.state.selectedTransaction.amount
                                ).nonSciString
                              })`}
                            </Text>
                          </View>
                        );
                      }}
                    </UnitConsumer>
                    <View style={{ flexDirection: 'row' }}>
                      <Text style={style.transactionsDetailText}>{`${translate(
                        'status'
                      )}: `}</Text>
                      <Text
                        style={{
                          ...style.transactionsDetailText,
                          color: `${this.context.theme.PRIMARY_COLOR}`,
                          flex: 1,
                        }}
                      >
                        {this.state.selectedTransaction.status}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row' }}>
                      <Text style={style.transactionsDetailText}>{`${translate(
                        'payee'
                      )}: `}</Text>
                      <Text
                        style={{
                          ...style.transactionsDetailText,
                          color: `${this.context.theme.PRIMARY_COLOR}`,
                          flex: 1,
                        }}
                      >
                        {this.state.selectedTransaction.payee}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row' }}>
                      <Text style={style.transactionsDetailText}>{`${translate(
                        'description'
                      )}: `}</Text>
                      <Text
                        style={{
                          ...style.transactionsDetailText,
                          color: `${this.context.theme.PRIMARY_COLOR}`,
                          flex: 1,
                        }}
                      >
                        {this.state.selectedTransaction.description}
                      </Text>
                    </View>
                  </View>
                ) : (
                  // Onchain Txs
                  <View>
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
                        {translate('onchainTx')}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row' }}>
                      <Text style={style.transactionsDetailText}>{`${translate(
                        'category'
                      )}: `}</Text>
                      <Text
                        style={{
                          ...style.transactionsDetailText,
                          color: `${this.context.theme.PRIMARY_COLOR}`,
                          flex: 1,
                        }}
                      >
                        {this.state.selectedTransaction.category !== 'deposit'
                          ? translate('withdraw')
                          : translate('deposit')}
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
                        const satsText =
                          this.context.unit.displayName !== 'Satoshis'
                            ? `${this.state.selectedTransaction.amount} sats`
                            : `${Math.round(
                                this.state.selectedTransaction.amount
                              ) / 100000000} BTC`;
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
                              {`${satsText} (${
                                coinUnitObj.unitConverter(
                                  this.state.selectedTransaction.amount
                                ).nonSciString
                              })`}
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
                        {this.state.selectedTransaction.confirmations}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row' }}>
                      <Text style={style.transactionsDetailText}>{`${translate(
                        'address'
                      )}: `}</Text>
                      <Text
                        style={{
                          ...style.transactionsDetailText,
                          color: `${this.context.theme.PRIMARY_COLOR}`,
                          flex: 1,
                        }}
                      >
                        {this.state.selectedTransaction.address}
                      </Text>
                    </View>
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
                          {translate('sharePaymentLink')}
                        </Text>
                      </TouchableOpacity>
                      <View style={{ flex: 1 }} />
                    </View>
                  </View>
                )}
              </SafeAreaView>
            </View>
          </View>
        )}
      </Modal>
    );
  };

  handleCheckLocation = async type => {
    let permission = '';

    if (Platform.OS === 'android') {
      permission = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
    } else {
      permission = await RNLocation.requestPermission({
        ios: 'whenInUse',
      });
    }

    const checkLocationPermission = await RNLocation.getCurrentPermission();

    if (
      Platform.OS === 'android' &&
      permission === 'never_ask_again' &&
      checkLocationPermission !== 'authorizedFine'
    ) {
      Alert.alert(
        'Location Disabled',
        'Please ensure lastbit GO has location access.',
        [
          {
            text: 'Back',
            style: 'destructive',
            onPress: () => null,
          },
          {
            text: 'Settings',
            onPress: () => {
              Linking.openSettings();
            },
          },
        ]
      );
    } else if (
      permission === true ||
      checkLocationPermission === 'authorizedWhenInUse' ||
      checkLocationPermission === 'authorizedFine'
    ) {
      if (type === 'payNearBy') {
        this.setState({
          payLightningNearbyVisible: true,
        });
      } else if (type === 'createInvoice') {
        // invoice
        this.setState({ invoiceRequested: true });
        this.raiseInvoice().done();
      }
    } else if (permission === false || checkLocationPermission === 'denied') {
      if (type === 'createInvoice') {
        Alert.alert(
          'Location Disabled',
          'lastbit GO location is disabled, still want to create the invoice.',
          [
            {
              text: 'Back',
              style: 'destructive',
              onPress: () => {
                this.setState({
                  receiveLightningPaymentVisible: false,
                  invoiceRequested: false,
                });
              },
            },
            {
              text: 'Create',
              onPress: () => {
                this.setState({ invoiceRequested: true });
                this.raiseInvoice().done();
              },
            },
          ]
        );
      } else {
        Alert.alert(
          'Location Disabled',
          'Please ensure lastbit GO has location access.',
          [
            {
              text: 'Back',
              style: 'destructive',
              onPress: () => {
                this.setState({
                  receiveLightningPaymentVisible: false,
                  invoiceRequested: false,
                });
              },
            },
            {
              text: 'Settings',
              onPress: () => {
                Linking.openSettings();
              },
            },
          ]
        );
      }
    }
  };

  render() {
    const { translate, unitConverter, theme, cycleUnits, unit } = this.context;
    Reactotron.log(this.state);
    return (
      <ThemeConsumer>
        {themeObj => {
          if (!style || themeObj.themeChanged) {
            style = themeObj.createStyle(
              generateStyleSheet,
              'Lightning Screen'
            );
          }
          return (
            <SafeAreaView style={style.safeContainer}>
              {this.renderHeader()}
              {this.renderAppropriateContent()}
              <View style={style.containerView}>
                {this.renderTransactionPopupView()}
                {this.renderActionButtons()}
                {this.renderTransactionsList()}
                {this.state.transactions &&
                  this.state.transactions.length >= 0 &&
                  this.state.contentMode == 'receive' &&
                  !this.state.qrScannerVisible && (
                    <View style={{ flex: 1, minHeight: 100 }}>
                      <TouchableOpacity
                        style={{
                          ...this.context.theme.WIDE_BTN_CONTAINER,
                          flex: 1,
                          paddingBottom: 10,
                          flexDirection: 'row',
                          justifyContent: 'center',
                        }}
                        onPress={() => Linking.openURL('https://htlc.me/')}
                      >
                        <Text
                          style={this.context.theme.BTN_PRIMARY}
                          numberOfLines={1}
                        >
                          {translate('testWebWallet')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                {this.state.transactions &&
                  this.state.contentMode == 'send' &&
                  this.state.transactions.length >= 0 && (
                    <View style={{ flex: 1, minHeight: 100 }}>
                      <TouchableOpacity
                        style={{
                          ...this.context.theme.WIDE_BTN_CONTAINER,
                          flex: 1,
                          flexDirection: 'row',
                          justifyContent: 'center',
                        }}
                        onPress={async () => {
                          Mixpanel.track(
                            'Lightning Make Nearby Payment Pressed '
                          );
                          //
                          this.handleCheckLocation('payNearBy');
                        }}
                      >
                        <Text
                          style={this.context.theme.BTN_PRIMARY}
                          numberOfLines={1}
                        >
                          {translate('makeNearbyPayment')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                <Modal
                  visible={this.state.addFundsModalVisible}
                  onRequestClose={() =>
                    this.setState({ addFundsModalVisible: false })
                  }
                  transparent
                  animationType="fade"
                >
                  <AddLightningFunds
                    onRequestClose={() =>
                      this.setState({ addFundsModalVisible: false })
                    }
                    refresh={() => setTimeout(() => this.refresh(), 4000)}
                  />
                </Modal>
                <Modal
                  visible={this.state.lastbitIdModalVisible}
                  transparent
                  animationType="fade"
                  onRequestClose={() =>
                    this.setState({ lastbitIdModalVisible: false })
                  }
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
                      <View style={{ alignItems: 'flex-start' }}>
                        <View
                          style={{
                            flexDirection: 'row',
                            justifyContent: 'center',
                            alignItems: 'center',
                            marginTop: 10,
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
                                hidEdit: false,
                                newLastbitID: '',
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
                            allowFontScaling={false}
                            style={{
                              color: 'white',
                              fontFamily: 'Quicksand-Bold',
                              fontSize: 24,
                              lineHeight: 26,
                            }}
                          >
                            {translate('showLastbitIdTitle')}
                          </Text>
                        </View>
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'flex-start',
                          }}
                        >
                          <Text
                            allowFontScaling={false}
                            style={{
                              color: 'orange',
                              fontFamily: 'Quicksand-Bold',
                              fontSize: 12,
                              textAlign: 'left',
                              marginVertical: 5,
                            }}
                          >
                            {'Case Sensitive'}
                          </Text>
                        </View>
                        <View
                          style={{
                            marginTop: 10,
                            flexDirection: 'row',
                            alignItems: 'flex-start',
                          }}
                        >
                          {!this.state.hidEdit ? (
                            <>
                              <Text
                                allowFontScaling={false}
                                style={{
                                  flex: 3,
                                  color: 'white',
                                  fontFamily: 'Quicksand-Bold',
                                  paddingTop: 5,
                                  fontSize: 20,
                                }}
                              >
                                {this.state.userLastbitId}
                              </Text>
                              <TouchableOpacity
                                style={{ flex: 1, borderRadius: 25 }}
                                onPress={() => this.setState({ hidEdit: true })}
                              >
                                <Icon
                                  name="edit"
                                  size={36}
                                  style={themeObj.theme.BTN_SECONDARY}
                                  color={themeObj.theme.SECONDARY_COLOR}
                                />
                              </TouchableOpacity>
                            </>
                          ) : (
                            <>
                              <TextInput
                                value={this.state.newLastbitID}
                                onChangeText={text =>
                                  this.setState({ newLastbitID: text })
                                }
                                placeholder={translate(
                                  'newLastbitIDPlaceholder'
                                )}
                                placeholderTextColor="#444444"
                                autoCapitalize="none"
                                autoFocus
                                style={{
                                  flex: 3,
                                  paddingLeft: 12,
                                  height: 42,
                                  marginRight: 5,
                                  backgroundColor: '#efefef',
                                  borderRadius: 25,
                                  color: '#444444',
                                  fontFamily: 'Quicksand-Bold',
                                  fontSize: 16,
                                }}
                              />
                              <TouchableOpacity
                                style={{ flex: 1, borderRadius: 25 }}
                                onPress={this.changeLastbitID}
                              >
                                <Icon
                                  name="arrow-forward"
                                  size={24}
                                  style={themeObj.theme.BTN_PRIMARY}
                                  color={themeObj.theme.SECONDARY_COLOR}
                                />
                              </TouchableOpacity>
                            </>
                          )}
                        </View>
                      </View>
                      <Text
                        allowFontScaling={false}
                        style={{
                          color: 'white',
                          fontFamily: 'Quicksand-Bold',
                          fontSize: 15,
                          textAlign: 'center',
                          marginVertical: 30,
                        }}
                      >
                        {translate('showLastbitIdSubtitle')}
                      </Text>
                      <View
                        style={{
                          justifyContent: 'center',
                          padding: 20,
                          backgroundColor: 'white',
                        }}
                      >
                        <QRCode value={this.state.userLastbitId} size={200} />
                      </View>
                      <View
                        style={{ flexDirection: 'row', marginVertical: 40 }}
                      >
                        <TouchableOpacity
                          style={style.actionBtn}
                          onPress={this.copyUserId}
                        >
                          <Text
                            allowFontScaling={false}
                            style={{
                              color: 'white',
                              fontFamily: 'Quicksand-Bold',
                              fontSize: 12,
                            }}
                          >
                            {translate('copylbID')}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={{ ...style.actionBtn, marginLeft: 10 }}
                          onPress={() => {
                            Share.share({
                              message: this.state.userLastbitId,
                            });
                          }}
                        >
                          <Text
                            allowFontScaling={false}
                            style={{
                              color: 'white',
                              fontFamily: 'Quicksand-Bold',
                              fontSize: 12,
                            }}
                          >
                            {translate('sharelbID')}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </SafeAreaView>
                  <DropdownAlert ref={d => (this.dropdownAlert = d)} />
                </Modal>
                <Modal
                  visible={this.state.lnInfoVisible}
                  transparent
                  animationType="fade"
                  onRequestClose={() => this.setState({ lnInfoVisible: false })}
                >
                  <TouchableOpacity
                    style={{ flex: 1 }}
                    activeOpacity={1}
                    onPressOut={() => this.setState({ lnInfoVisible: false })}
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
                      <SafeAreaView style={{ flex: 1 }}>
                        <View
                          style={{
                            flex: 1,
                            justifyContent: 'flex-start',
                            padding: 20,
                          }}
                        >
                          <View
                            style={{
                              backgroundColor: 'whitesmoke',
                              padding: 20,
                            }}
                          >
                            <Text
                              style={{
                                ...style.deviceTitleText,
                                color: themeObj.theme.COLOR_INFO,
                                marginBottom: 15,
                              }}
                            >
                              {`${translate('lightningTitle')}`}
                            </Text>
                            {/* <Text
                              style={{
                                color: themeObj.theme.PRIMARY_COLOR,
                                fontFamily: 'Quicksand-Medium',
                                fontSize: 15,
                                textAlign: 'justify',
                                marginVertical: 20,
                              }}
                            >
                              {translate('lnInfoText')}
                            </Text> */}
                            {/* <Text
                              style={{
                                color: themeObj.theme.PRIMARY_COLOR,
                                fontFamily: 'Quicksand-Medium',
                                fontSize: 15,
                                marginVertical: 20,
                              }}
                            >
                              {`${translate('youAreUsing')} `}
                              <Text
                                style={{
                                  ...style.deviceSubtitleText,
                                  color: themeObj.theme.COLOR_INFO,
                                }}
                              >
                                {this.state.lightningNodeName}
                              </Text>
                              {` ${translate('toPayLN')}`}
                            </Text> */}
                            <View
                              style={{
                                flexDirection: 'row',
                                justifyContent: 'space-evenly',
                                alignItems: 'center',
                              }}
                            >
                              <TouchableOpacity
                                style={{ height: 60 }}
                                onPress={() => {
                                  cycleUnits();
                                  Mixpanel.trackWithProperties(
                                    'Lightning Info Change Currency',
                                    { currency: unit.displayName }
                                  );
                                }}
                              >
                                <View
                                  style={{
                                    flex: 1,
                                    alignItems: 'center',
                                    marginHorizontal: 5,
                                  }}
                                >
                                  <Text
                                    style={{
                                      fontFamily: 'Quicksand-Regular',
                                      fontSize: theme.FONT_SIZE_MEDIUM,
                                      textAlign: 'center',
                                      color: '#777777',
                                    }}
                                  >
                                    Safe Send
                                  </Text>
                                  <Text
                                    style={{
                                      fontFamily: 'Quicksand-Bold',
                                      fontSize: 16,
                                      marginTop: 8,
                                      color: 'black',
                                    }}
                                  >
                                    {
                                      unitConverter(this.state.safe_send)
                                        .nonSciString
                                    }
                                  </Text>
                                </View>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={{ height: 60 }}
                                onPress={() => {
                                  cycleUnits();
                                  Mixpanel.trackWithProperties(
                                    'Lightning Info Change Currency',
                                    { currency: unit.displayName }
                                  );
                                }}
                              >
                                <View
                                  style={{
                                    flex: 1,
                                    alignItems: 'center',
                                    marginHorizontal: 5,
                                  }}
                                >
                                  <Text
                                    style={{
                                      fontFamily: 'Quicksand-Regular',
                                      fontSize: theme.FONT_SIZE_MEDIUM,
                                      textAlign: 'center',
                                      color: '#777777',
                                    }}
                                  >
                                    Safe Receive
                                  </Text>
                                  <Text
                                    style={{
                                      fontFamily: 'Quicksand-Bold',
                                      fontSize: 16,
                                      marginTop: 8,
                                      color: 'black',
                                    }}
                                  >
                                    {
                                      unitConverter(this.state.safe_receive)
                                        .nonSciString
                                    }
                                  </Text>
                                </View>
                              </TouchableOpacity>
                            </View>
                            <View
                              style={{
                                flexDirection: 'row',
                                justifyContent: 'space-evenly',
                                alignItems: 'center',
                              }}
                            >
                              <TouchableOpacity
                                style={{ height: 60 }}
                                onPress={() => {
                                  cycleUnits();
                                  Mixpanel.trackWithProperties(
                                    'Lightning Info Change Currency',
                                    { currency: unit.displayName }
                                  );
                                }}
                              >
                                <View
                                  style={{
                                    flex: 1,
                                    alignItems: 'center',
                                    marginHorizontal: 5,
                                  }}
                                >
                                  <Text
                                    style={{
                                      fontFamily: 'Quicksand-Regular',
                                      fontSize: theme.FONT_SIZE_MEDIUM,
                                      textAlign: 'center',
                                      color: '#777777',
                                    }}
                                  >
                                    Max Send
                                  </Text>
                                  <Text
                                    style={{
                                      fontFamily: 'Quicksand-Bold',
                                      fontSize: 16,
                                      marginTop: 8,
                                      color: 'black',
                                    }}
                                  >
                                    {
                                      unitConverter(this.state.max_outgoing)
                                        .nonSciString
                                    }
                                  </Text>
                                </View>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={{ height: 60 }}
                                onPress={() => {
                                  cycleUnits();
                                  Mixpanel.trackWithProperties(
                                    'Lightning Info Change Currency',
                                    { currency: unit.displayName }
                                  );
                                }}
                              >
                                <View
                                  style={{
                                    flex: 1,
                                    alignItems: 'center',
                                    marginHorizontal: 5,
                                  }}
                                >
                                  <Text
                                    style={{
                                      fontFamily: 'Quicksand-Regular',
                                      fontSize: theme.FONT_SIZE_MEDIUM,
                                      textAlign: 'center',
                                      color: '#777777',
                                    }}
                                  >
                                    Max Receive
                                  </Text>
                                  <Text
                                    style={{
                                      fontFamily: 'Quicksand-Bold',
                                      fontSize: 16,
                                      marginTop: 8,
                                      color: 'black',
                                    }}
                                  >
                                    {
                                      unitConverter(this.state.max_incoming)
                                        .nonSciString
                                    }
                                  </Text>
                                </View>
                              </TouchableOpacity>
                            </View>
                            <View>
                              <Text
                                style={{
                                  marginTop: 10,
                                  fontFamily: 'Quicksand-Regular',
                                  fontSize: theme.FONT_SIZE_MEDIUM,
                                  textAlign: 'left',
                                  color: '#777777',
                                }}
                              >
                                <Text
                                  style={{
                                    fontFamily: 'Quicksand-Bold',
                                  }}
                                >
                                  Note:
                                </Text>
                                {
                                  '\nHeavily under development, database may be cleared periodically.'
                                }
                              </Text>
                            </View>
                            {/* <View>
                              <VictoryStack
                                horizontal
                                width={Dimensions.get('screen').width - 60}
                                style={{
                                  data: { stroke: 'black', strokeWidth: 2 },
                                }}
                                horizontal
                                // animate
                                height={Dimensions.get('screen').height / 3}
                                // padding={{ top: 20, bottom: Dimensions.get('screen').height / 3 }}
                                // style={{ data: { fill: (d) => d.fill }, labels: { fill: "white" } }}
                                colorScale={[
                                  '#52dd90',
                                  '#0f916f',
                                  '#3498db',
                                  '#90d3ff',
                                ]}
                              >
                                <VictoryBar
                                  labels={d => d.label}
                                  labelComponent={
                                    <VictoryLabel dx={-100} dy={30} />
                                  }
                                  data={[
                                    {
                                      x: 'a',
                                      y: this.state.max_incoming,
                                      // y: 3,
                                      // label: 'Max In',
                                    },
                                  ]}
                                  barWidth={40}
                                />
                                <VictoryBar
                                  labels={d => d.label}
                                  labelComponent={
                                    <VictoryLabel dx={-100} dy={30} />
                                  }
                                  data={[
                                    {
                                      x: 'a',
                                      y: this.state.safe_receive,
                                      // y: 3,
                                      // label: 'Safe In',
                                    },
                                  ]}
                                  barWidth={40}
                                />
                                <VictoryBar
                                  labels={d => d.label}
                                  labelComponent={
                                    <VictoryLabel dx={-60} dy={30} />
                                  }
                                  data={[
                                    {
                                      x: 'a',
                                      y: this.state.safe_send,
                                      // y: 1,
                                      // label: 'Safe Out',
                                    },
                                  ]}
                                  barWidth={40}
                                />
                                <VictoryBar
                                  labels={d => d.label}
                                  labelComponent={
                                    <VictoryLabel dx={-20} dy={30} />
                                  }
                                  data={[
                                    {
                                      x: 'a',
                                      // y: 3,
                                      y: this.state.max_outgoing,
                                      // label: 'Max Out',
                                    },
                                  ]}
                                  barWidth={40}
                                />
                              </VictoryStack>
                            </View> */}
                          </View>
                        </View>
                      </SafeAreaView>
                    </View>
                  </TouchableOpacity>
                </Modal>
                {this.state.receiveLightningPaymentVisible && (
                  <ReceiveLightningPayment
                    expiresAt={this.state.invoiceExpiresAt}
                    visible={this.state.receiveLightningPaymentVisible}
                    onRequestClose={() => {
                      this.setState({
                        receiveLightningPaymentVisible: false,
                        invoiceRequested: false,
                      });
                    }}
                    bolt11={this.state.invoiceBolt11}
                    label={this.state.invoiceLabel}
                    invoiceAmount={`${this.context.unit.symbol} ${this.state.invoiceAmount}`}
                    invoicePaid={() => {
                      this.refresh();
                      if (this.state.invoiceAmount > 0) {
                        setTimeout(() => {
                          Mixpanel.trackWithProperties(
                            'Lightning Receive Success',
                            {
                              message: `${this.state.invoiceAmount}${
                                this.context.unit.displayName
                              } ${translate('receivedPaymentMsg')}`,
                            }
                          );
                          window.EventBus.trigger('showDropdownAlert', {
                            type: 'success',
                            title: translate('receivedPayment'),
                            message: `${this.state.invoiceAmount}${
                              this.context.unit.displayName
                            } ${translate('receivedPaymentMsg')}`,
                          });
                          this.props.handleSwipeGesture(true);
                          this.setState({
                            receiveLightningPaymentVisible: false,
                            invoiceAmount: '',
                            invoiceDescription: '',
                            invoiceLabel: '',
                            contentMode: 'balance',
                            invoiceRequested: false,
                          });
                        }, 3600);
                      }
                    }}
                  />
                )}
              </View>
            </SafeAreaView>
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
        <LightningScreen
          {...this.props}
          handleSwipeGesture={this.handleSwipeGesture}
        />
      </ProvideCombinedContext>
    );
  }
}
