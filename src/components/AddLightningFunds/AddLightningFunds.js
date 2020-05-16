import React, { Component } from 'react';
import {
  View,
  SafeAreaView,
  ActivityIndicator,
  Text,
  LayoutAnimation,
  TextInput,
  TouchableOpacity,
  Modal,
  Clipboard,
  Dimensions,
  Platform,
  Image
} from 'react-native';
import Reactotron from 'reactotron-react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Mixpanel from 'react-native-mixpanel';
import transaction from 'transaction-manager';
import NetworkManager from 'network-manager';
import config from 'config';
import wallet from 'wallet-manager';
import bitcoin from 'rn-bitcoinjs-lib';
import LightningManager from 'lightning-manager';
import { UnitConsumer } from 'unit-manager';
import ProvideCombinedContext, { CombinedContext } from 'state-manager';
import validator from 'validator';
import QRCode from 'react-native-qrcode-svg';
import { Sentry } from 'react-native-sentry';
import style from './style';
import { CustomLayoutAnimation } from '../../shared/HelpingMethods';
import QRCodeScanner from 'react-native-qrcode-scanner';

const { width } = Dimensions.get('window');

class AddLightningFunds extends Component {
  static contextType = CombinedContext;

  constructor(props) {
    super(props);
    this.state = {
      utxos: null,
      sighashResponse: null,
      onChainBalance: null,
      onLightningBalance: 0,
      depositAddress: null,
      sendAmount: '',
      depositTrue: true,
      paymentInProgress: false,
      receivingAddress: '',
      changeAddress: null,
      lowerBound: 10000,
      unsignedTransactionResponse: null,
      receivingAddressVisible: false,
      errorMsg: '',
      qrCodeScannerVisible: false,
    };
  }

  componentDidMount() {
    this.fetchUTXOs().done();
    this.fetchLightningBalance().done();
    this.fetchFundingAddress().done();
  }

  fetchFundingAddress = async () => {
    const address = await LightningManager.getFundingAddress();
    if (address) {
      this.setState({ depositAddress: address });
    }
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

  fetchUTXOs = async () => {
    const receiveResponse = await NetworkManager.getUTXOs();
    if (receiveResponse && receiveResponse.success) {
      utxos = Object.values(receiveResponse.utxos);

      onChainBalance = receiveResponse.satoshis;
    }
    this.setState({ utxos, onChainBalance });
  };

  sendMax = async () => {
    try {
      const unsignedTransactionResponse = await transaction.getUnsignedTransaction(
        this.state.utxos,
        [
          {
            address: this.state.depositAddress,
            value: this.state.onChainBalance - 20000,
          },
        ],
        0
      );

      const hex = transaction.inAppSignTransaction(
        unsignedTransactionResponse.tb,
        unsignedTransactionResponse.orderedUtxos
      );

      const sizeInBytes = parseInt(hex.length / 2);
      const fee = sizeInBytes * 55;
      const maxAmountSatoshis = this.state.onChainBalance - fee;
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

  fetchLightningBalance = async () => {
    const onLightningBalance = await LightningManager.getUserBalance();
    this.setState({ onLightningBalance });
  };

  generateSigHashes = async amount => {
    Reactotron.log({
      Utxos: this.state.utxos,
      sendAddress: this.state.depositAddress,
      amount,
    });
    const unsignedTransactionResponse = await transaction.getUnsignedTransaction(
      this.state.utxos,
      [
        {
          address: this.state.depositAddress,
          value: amount,
        },
      ],
      this.state.selectedFee
    );

    const { success, message } = unsignedTransactionResponse;

    if (success === false) {
      Sentry.captureMessage(`AddLightningFunds Error: ${message}`);
      window.EventBus.trigger('showDropdownAlert', {
        type: 'error',
        title: this.context.translate('error'),
        message,
      });
      this.props.onRequestClose();
    }

    LayoutAnimation.configureNext(CustomLayoutAnimation(200));

    this.setState({ unsignedTransactionResponse, sendAmount: amount });
  };

  signAndBroadcastTransaction = async () => {
    const hex = transaction.inAppSignTransaction(
      this.state.unsignedTransactionResponse.tb,
      this.state.unsignedTransactionResponse.orderedUtxos
    );
    const response = await NetworkManager.broadcastTransaction(hex);

    if (response.success === true) {
      window.EventBus.trigger('showDropdownAlert', {
        type: 'success',
        title: this.context.translate('successTxBroadcastTitle'),
        message: this.context.translate('successTxBroadcastMsg'),
      });
    }
    this.props.onRequestClose();
  };

  depositFunds = async () => {
    this.setState({ paymentInProgress: true });
    this.signAndBroadcastTransaction().done();
    this.setState({ paymentInProgress: false });
    this.props.refresh();
    await this.props.onRequestClose();
  };

  withdrawFunds = async () => {
    const { translate } = this.context;
    this.setState({ paymentInProgress: true });
    Reactotron.log('Attempting to Withdraw');

    const { sendAmount, receivingAddress } = this.state;
    const response = await LightningManager.withdrawToAddress(
      receivingAddress,
      sendAmount
    );
    this.setState({ paymentInProgress: false });
    if (response.success) {
      window.EventBus.trigger('showDropdownAlert', {
        type: 'success',
        title: translate('successWithdrawalTitle'),
        message: translate('successWithdrawalMsg'),
      });
    } else {
      Mixpanel.track('AddLightningFunds Error: Withdrawal unsuccessful');
      window.EventBus.trigger('showDropdownAlert', {
        type: 'error',
        title: translate('error'),
        message: translate('plsTryAgain'),
      });
    }
    this.props.refresh();
    this.props.onRequestClose();
  };

  validateAddress = address => {
    if (this.state.receivingAddress !== '') {
      try {
        bitcoin.address.toOutputScript(address, config.bitcoinNetwork);
        return true;
      } catch (error) {
        Sentry.captureException(error);
        return false;
      }
    }
  };

  qrCodeScanned = event => {
    const copiedString = event.data.replace('bitcoin:', '');
    LayoutAnimation.configureNext(CustomLayoutAnimation(200));
    this.setState({
      receivingAddress: copiedString,
      qrCodeScannerVisible: false,
    });
  };

  confirmPressed = async () => {
    const { translate } = this.context;
    Mixpanel.track('Lightning Confirm Pressed');
    const {
      lowerBound,
      onChainBalance,
      onLightningBalance,
      depositTrue,
      sendAmount,
    } = this.state;
    Reactotron.log(
      `lowerBound = ${lowerBound}`,
      `onChainBalance= ${onChainBalance}`,
      `onLightningBalance= ${onLightningBalance}`,
      `depositTrue= ${depositTrue}`,
      `sendAmount= ${sendAmount}`,
      `receivingAddress= ${this.state.receivingAddress}`
    );
    if (validator.isNumeric(`${sendAmount}`)) {
      if (this.context.unit.id == 0) {
        if (!validator.isInt(`${sendAmount}`)) {
          Mixpanel.trackWithProperties('Lightning Confirm Error', {
            errorMsg: 'Satoshis cannot be fractional',
          });
          this.setState({
            errorMsg: translate('errFractionalSatsTitle'),
            sendAmount: `${Math.round(sendAmount)}`,
          });
          return;
        }
      }
    } else {
      Mixpanel.trackWithProperties('Lightning Confirm Error', {
        errorMsg: 'Please enter a numeric amount.',
      });
      this.setState({
        errorMsg: translate('errWithdrawNANAmount'),
        sendAmount: '',
      });
      return;
    }

    if (this.state.depositTrue == false) {
      if (!this.validateAddress(this.state.receivingAddress)) {
        Mixpanel.trackWithProperties('Lightning Confirm Error', {
          errorMsg: 'Please enter a valid bitcoin address to withdraw to.',
        });
        this.setState({
          errorMsg: translate('errWithdrawInvalidAddr'),
        });
        return;
      }
    }

    // Convert to sats
    const amount =
      this.context.unit.id > 1
        ? parseFloat(this.state.sendAmount).toFixed(2)
        : this.state.sendAmount;
    let amountSats =
      this.context.unit.conversionName == 'fiat'
        ? (amount / this.context.unit.multiplier) * 100000000
        : amount * this.context.unit.multiplier;
    amountSats = Math.round(amountSats);
    if (depositTrue) {
      if (amountSats >= lowerBound && amountSats <= onChainBalance) {
        Reactotron.log(`Attempting to deposit ${amountSats} satoshis`);
        await this.generateSigHashes(amountSats);
        Mixpanel.track('Lightning Deposit Confirm Success');
        this.setState({ renderConfirm: true, sendAmount: amountSats });
      } else if (onChainBalance == null) {
        Mixpanel.trackWithProperties('Lightning Confirm Error', {
          errorMsg: 'Error: Could not fetch bitcoin balance',
        });
        this.setState({ errorMsg: 'Error: Could not fetch bitcoin balance' });
      }
      // Can't get utxos
      else if (onChainBalance == 0) {
        Mixpanel.trackWithProperties('Lightning Confirm Error', {
          errorMsg:
            'You have no funds in your Onchain wallet available for Deposit.',
        });
        this.setState({
          errorMsg: translate('errDepositNoBalance'),
        });
      } else {
        Mixpanel.trackWithProperties('Lightning Confirm Error', {
          errorMsg: `Deposit between ${
            this.context.unitConverter(lowerBound).nonSciString
            } and ${this.context.unitConverter(onChainBalance).nonSciString}`,
        });
        this.setState({
          errorMsg: `Min: ${
            this.context.unitConverter(lowerBound).nonSciString
            }; Max: ${this.context.unitConverter(onChainBalance).nonSciString}`,
        });
      }
      // TODO: Handle fees
    } else {
      if (amountSats >= lowerBound && amountSats <= onLightningBalance) {
        this.setState({ renderConfirm: true, sendAmount: amountSats });
      } else if (onLightningBalance == 0) {
        Mixpanel.trackWithProperties('Lightning Confirm Error', {
          errorMsg:
            'You have no funds in your Lightning wallet available for Withdrawal.',
        });
        this.setState({
          errorMsg: translate('errWithdrawNoBalance'),
        });
      } else {
        Mixpanel.trackWithProperties('Lightning Confirm Error', {
          errorMsg: `Withdraw between ${
            this.context.unitConverter(lowerBound).nonSciString
            } and ${this.context.unitConverter(onLightningBalance).nonSciString}`,
        });
        this.setState({
          errorMsg: `Min: ${
            this.context.unitConverter(lowerBound).nonSciString
            }; Max: ${
            this.context.unitConverter(onLightningBalance).nonSciString
            }`,
        });
      }
      // TODO: Handle fees
    }
  };

  render() {
    const { translate } = this.context;
    return (
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)' }}>
        <Modal
          visible={this.state.receivingAddressVisible}
          transparent
          animationType="fade"
          onRequestClose={() =>
            this.setState({ receivingAddressVisible: false })
          }
        >
          <View
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.8)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View style={{ alignSelf: 'flex-start', marginLeft: 32 }}>
              <Text
                style={[
                  style.deviceTitleText,
                  { color: '#FFF', textAlign: 'left' },
                ]}
              >
                {`${translate('deposit')} ${translate('address')}`}
              </Text>
            </View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 20,
              }}
            >
              <Text
                style={[
                  {
                    marginRight: 12,
                    fontFamily: 'QuickSand-Medium',
                    fontSize: 11,
                    color: 'white',
                  },
                ]}
              >
                {this.state.depositAddress}
              </Text>
              <TouchableOpacity
                style={{
                  backgroundColor: 'rgba(0,0,0,0.8)',
                  borderColor: 'white',
                  borderWidth: 1,
                  padding: 5,
                }}
                onPress={() => Clipboard.setString(this.state.depositAddress)}
              >
                <Text style={[style.borderedTouchableText, { color: 'white' }]}>
                  {translate('copy')}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={{ padding: 20, backgroundColor: 'white' }}>
              <QRCode value={`${this.state.depositAddress}`} size={240} />
            </View>
            <Text
              style={{
                padding: 20,
                textAlign: 'center',
                color: 'white',
                fontSize: 12,
                color: 'white',
              }}
            >
              {translate('depositText')}
            </Text>
            <TouchableOpacity style={{ marginTop: 50 }}>
              <Text
                style={{
                  fontFamily: 'QuickSand-Medium',
                  fontSize: 15,
                  color: 'white',
                }}
                onPress={() =>
                  this.setState({ receivingAddressVisible: false })
                }
              >
                {translate('back')}
              </Text>
            </TouchableOpacity>
          </View>
        </Modal>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={{ flex: 1, justifyContent: 'flex-start', padding: 20 }}>
            <View style={{ backgroundColor: 'whitesmoke', padding: 20 }}>
              {!this.state.renderConfirm ? (
                <View>
                  <View style={{ alignSelf: 'center' }}>
                    <TouchableOpacity
                      style={[
                        style.toggleButtonTouchable,
                        { width: width / 2 },
                      ]}
                      onPress={() => {
                        Mixpanel.track(
                          `Lightning ${
                          this.state.depositTrue
                            ? translate('deposit')
                            : translate('withdraw')
                          } Pressed`
                        );
                        this.setState({
                          depositTrue: !this.state.depositTrue,
                          errorMsg: '',
                        });
                      }}
                    >
                      <Icon
                        name={
                          this.state.depositTrue
                            ? 'arrow-up-bold-hexagon-outline'
                            : 'arrow-down-bold-hexagon-outline'
                        }
                        color={this.state.depositTrue ? '#197216' : '#ff6666'}
                        size={28}
                      />
                      <Text style={style.toggleButtonText}>
                        {this.state.depositTrue
                          ? translate('deposit')
                          : translate('withdraw')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <View style={style.availableFundsContainer}>
                    <Text style={style.availableFundsText}>
                      {this.state.depositTrue
                        ? `Bitcoin ${translate('balance')}: `
                        : `${translate('lightning')} ${translate('balance')}: `}
                    </Text>
                    <UnitConsumer>
                      {coinUnitObj => {
                        if (this.state.depositTrue) {
                          if (this.state.onChainBalance != null) {
                            return (
                              <TouchableOpacity
                                onPress={() => {
                                  Mixpanel.trackWithProperties(
                                    'Lightning Change Currency',
                                    {
                                      currency: coinUnitObj.unit.displayName,
                                    }
                                  );
                                  coinUnitObj.cycleUnits();
                                }}
                              >
                                <Text style={style.availableFundsText}>
                                  {
                                    coinUnitObj.unitConverter(
                                      this.state.onChainBalance
                                    ).nonSciString
                                  }
                                </Text>
                              </TouchableOpacity>
                            );
                          }
                          return (
                            <ActivityIndicator
                              style={style.spinner}
                              color={`${this.context.theme.PRIMARY_COLOR}`}
                            />
                          );
                        }
                        if (this.state.onLightningBalance != null) {
                          return (
                            <TouchableOpacity
                              onPress={() => {
                                Mixpanel.trackWithProperties(
                                  'Lightning Change Currency',
                                  {
                                    currency: coinUnitObj.unit.displayName,
                                  }
                                );
                                coinUnitObj.cycleUnits();
                              }}
                            >
                              <Text style={style.availableFundsText}>
                                {
                                  coinUnitObj.unitConverter(
                                    this.state.onLightningBalance
                                  ).nonSciString
                                }
                              </Text>
                            </TouchableOpacity>
                          );
                        }
                        return (
                          <ActivityIndicator
                            style={style.spinner}
                            color={`${this.context.theme.PRIMARY_COLOR}`}
                          />
                        );
                      }}
                    </UnitConsumer>
                  </View>
                  {this.state.qrCodeScannerVisible === true &&
                    <View
                      style={{
                        paddingHorizontal: '50%',
                        height: Dimensions.get('window').height / 4,
                        width: Dimensions.get('window').height / 4,
                        marginTop: 20,
                      }}
                    >
                      <QRCodeScanner
                        containerStyle={{
                          alignItems: 'center',
                          position: 'relative',
                        }}
                        cameraStyle={{
                          height: Dimensions.get('window').height / 4,
                          width: Dimensions.get('window').height / 4,
                          position: 'relative',
                          overflow: 'hidden'
                        }}
                        cameraProps={{ captureAudio: false }}
                        onRead={this.qrCodeScanned}
                      />
                    </View>
                  }
                  <View style={{ marginVertical: 10 }}>
                    <View style={style.textInlineBtnContainer}>
                      <TextInput
                        autoFocus
                        keyboardType="decimal-pad"
                        returnKeyType="done"
                        placeholder={`${translate('amount')} (${
                          this.context.unit.displayName
                          })`}
                        style={{ ...style.amountTextInput, flex: 5 }}
                        value={this.state.sendAmount}
                        onChangeText={text =>
                          this.setState({ sendAmount: text.replace(/,/, '.') })
                        }
                      />
                      {this.state.depositTrue && (
                        <TouchableOpacity
                          style={style.inlineBtn}
                          onPress={this.sendMax}
                        >
                          <Text>{translate('max')}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    {this.state.depositTrue === false && (
                      <View style={style.textInlineBtnContainer}>
                        <TextInput
                          returnKeyType="done"
                          multiline
                          placeholder={translate('address')}
                          style={[style.amountTextInput, { marginTop: 10, flex: 5 }]}
                          value={this.state.receivingAddress}
                          onChangeText={text =>
                            this.setState({ receivingAddress: text })
                          }
                        />
                        <TouchableOpacity
                          style={[style.inlineBtn, { borderWidth: 0 }]}
                          onPress={() => {
                            Mixpanel.track('Lightning Withdraw QR Scan Pressed');
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
                    )}
                    {this.state.depositTrue === false && (
                      <TouchableOpacity
                        onPress={() => this.getCurrentReceivingAddress()}
                      >
                        <Text
                          style={{
                            fontSize: 10,
                            marginTop: 10,
                            fontFamily: 'QuickSand-regular',
                            color: '#424242',
                          }}
                        >
                          {'Tap here to paste your Bitcoin Address'}
                        </Text>
                      </TouchableOpacity>
                    )}
                    {this.state.errorMsg !== '' && (
                      <View style={{ marginTop: 5 }}>
                        <Text style={{ color: 'red' }}>
                          {this.state.errorMsg}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <TouchableOpacity
                      style={{ ...style.borderedTouchable, borderWidth: 0 }}
                      onPress={() => this.props.onRequestClose()}
                    >
                      <Text style={style.borderedTouchableText}>
                        {translate('cancel')}
                      </Text>
                    </TouchableOpacity>
                    {this.state.depositTrue && (
                      <TouchableOpacity
                        style={{
                          ...style.borderedTouchable,
                          backgroundColor: 'white',
                        }}
                        onPress={() => {
                          Mixpanel.track(
                            'Lightning Deposit ToAddressed Pressed'
                          );
                          this.setState({ receivingAddressVisible: true });
                        }}
                      >
                        <Text style={style.borderedTouchableText}>
                          {translate('depositToAddr') ||
                            `${translate('deposit')} ${translate('toAddr')}`}
                        </Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={{
                        ...style.borderedTouchable,
                        backgroundColor: 'white',
                      }}
                      onPress={() => this.confirmPressed()}
                    >
                      <Text style={style.borderedTouchableText}>
                        {translate('confirm')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                  <View>
                    <Text style={style.deviceTitleText}>{`${translate(
                      'confirm'
                    )} ${
                      this.state.depositTrue
                        ? translate('deposit')
                        : translate('withdrawal')
                      }`}</Text>
                    <Text style={style.instructionsText}>
                      {`${translate('moveConf')} `}
                      <Text
                        style={{
                          ...style.instructionsText,
                          fontWeight: 'bold',
                          color: this.state.depositTrue ? '#197216' : '#ff6666',
                        }}
                      >
                        {this.state.depositTrue ? 'deposit ' : 'withdraw '}
                      </Text>
                      <UnitConsumer>
                        {coinUnitObj => (
                          <>
                            <Text
                              style={{
                                ...style.instructionsText,
                                fontWeight: 'bold',
                              }}
                            >
                              {
                                coinUnitObj.unitConverter(this.state.sendAmount)
                                  .nonSciString
                              }
                            </Text>
                            {coinUnitObj.unit.displayName !== 'Satoshis' && (
                              <Text
                                style={{
                                  ...style.instructionsText,
                                  fontWeight: 'bold',
                                }}
                              >
                                {` (${this.state.sendAmount} sats)`}
                              </Text>
                            )}
                          </>
                        )}
                      </UnitConsumer>
                      {' to '}
                      <Text
                        style={{
                          ...style.instructionsText,
                          fontWeight: 'bold',
                        }}
                      >
                        {this.state.depositTrue
                          ? this.state.depositAddress
                          : this.state.receivingAddress}
                      </Text>
                      {'?'}
                    </Text>
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                      }}
                    >
                      <TouchableOpacity
                        style={{ ...style.borderedTouchable, borderWidth: 0 }}
                        onPress={() => this.props.onRequestClose()}
                      >
                        <Text style={style.borderedTouchableText}>
                          {translate('cancel')}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{
                          ...style.borderedTouchable,
                          backgroundColor: 'white',
                        }}
                        onPress={() =>
                          this.state.depositTrue
                            ? this.depositFunds()
                            : this.withdrawFunds()
                        }
                      >
                        {this.state.paymentInProgress ? (
                          <ActivityIndicator />
                        ) : (
                            <Text style={style.borderedTouchableText}>
                              {this.state.depositTrue
                                ? translate('deposit')
                                : translate('withdraw')}
                            </Text>
                          )}
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
            </View>
          </View>
        </SafeAreaView>
      </View>
    );
  }
}

const ContextWrappedComponent = props => (
  <ProvideCombinedContext>
    <AddLightningFunds {...props} />
  </ProvideCombinedContext>
);

export default ContextWrappedComponent;
