import React, { Component } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  LayoutAnimation,
  Modal,
  Dimensions,
  Platform,
  PixelRatio,
  Linking,
  Alert,
} from 'react-native';
import LightningManager from 'lightning-manager';
import DropdownAlert from 'react-native-dropdownalert';
import bolt11 from 'bolt11';
import { Sentry } from 'react-native-sentry';
import RNLocation from 'react-native-location';

import { CustomLayoutAnimation } from '../../shared/HelpingMethods';

const { height, width } = Dimensions.get('window');

const guidelineBaseWidthiOS = size => (height > 667 ? 0.66 * size : 1.1 * size);
const guidelineBaseWidth = PixelRatio.getPixelSizeForLayoutSize(width) / 3;

const scale = size =>
  Platform.OS === 'ios'
    ? guidelineBaseWidthiOS(size)
    : (width / guidelineBaseWidth) * size;
const moderateScale = (size, factor = 0.5) =>
  size + (scale(size) - size) * factor;

const baseSizeArc = moderateScale(height) / 3.5;

export default class PayLightningNearbyScreen extends Component {
  constructor(props) {
    super(props);
    this.state = {
      selectedPayment: null,
      payments: [],
      selectedIndex: null,
    };
  }

  refreshInvoiceTimeout = null;

  async componentDidMount() {
    this.getNearbyInvoices().done();

    const checkLocationPermission = await RNLocation.getCurrentPermission();

    if (!checkLocationPermission.match(/denied|notDetermined/)) {
      this.refreshInvoiceTimeout = setInterval(() => {
        this.getNearbyInvoices().done();
      }, 10000);
    }
  }

  componentWillUnmount() {
    this.refreshInvoiceTimeout = null;
    clearTimeout(this.refreshInvoiceTimeout);
  }

  getNearbyInvoices = async () => {
    const response = await LightningManager.getNearbyInvoices();
    if (response.success === false) {
      Sentry.captureException(
        'PayLightningNearby Error: Unable to fetch nearby requests!'
      );
      window.EventBus.trigger('showDropdownAlert', {
        type: 'error',
        title: 'Unable to fetch nearby requests!',
        message:
          'Please ensure lastbit GO has location access and your internet connection is working.',
      });
    } else {
      this.setState({
        payments: response.response.payload.invoices.slice(0, 10),
      });
    }
  };

  payInvoice = async () => {
    const data = bolt11.decode(this.state.selectedPayment.bolt11);
    if (this.props.balance < data.satoshis) {
      // TODO Add language support
      // TODO Add unitConverter
      this.dropdownAlert.alertWithType(
        'error',
        'Insufficient Funds',
        `Cannot pay ${data.satoshis} sats. Available balance: ${this.props.balance} sats`
      );
      return;
    }

    const response = await LightningManager.payInvoice(
      this.state.selectedPayment.bolt11
    );
    if (response.status == 'complete') {
      window.EventBus.trigger('showDropdownAlert', {
        type: 'success',
        title: 'Paid successfully!',
        message: response.memo,
      });
      this.props.paymentCompleted();
    } else {
      this.setState({ paymentInProgress: false });
      Sentry.captureException('PayLightningNearby Error: Payment failed');
      window.EventBus.trigger('showDropdownAlert', {
        type: 'error',
        title: 'Payment failed',
        message: response.message,
      });
    }
  };

  renderSelectedPayment = (selectedPayment, description) => (
    <TouchableOpacity
      onPress={() => {}}
      style={{
        top: -75,
        position: 'absolute',
        width: 150,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          borderRadius: 30,
          height: 150,
          width: '100%',
          backgroundColor: `rgba(100,100,100,${1 / (2 * 0.35)})`,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            fontFamily: 'QuickSand-Medium',
            color: 'white',
            textAlign: 'center',
            fontSize: 12,
          }}
        >{`${selectedPayment.amount}\nsats`}</Text>
        <Text
          style={{
            fontFamily: 'QuickSand-Medium',
            color: 'white',
            textAlign: 'center',
            fontSize: 12,
            marginTop: 10,
          }}
        >
          {description}
        </Text>
      </View>
      <Text
        numberOfLines={1}
        style={{
          fontFamily: 'QuickSand-Medium',
          color: '#888888',
          textAlign: 'center',
          fontSize: 10,
        }}
      >{`${selectedPayment.hid}`}</Text>
      <Text
        style={{
          fontFamily: 'QuickSand-Medium',
          color: '#888888',
          textAlign: 'center',
          fontSize: 10,
        }}
      >{`${parseFloat(selectedPayment.dist.calculated).toFixed(
        2
      )}m away`}</Text>
    </TouchableOpacity>
  );

  renderPaymentRow = paymentRow => {
    const { selectedIndex } = this.state;
    if (this.state.selectedPayment !== null) {
      const selectedPayment = paymentRow.payments.find(
        payment => this.state.selectedPayment.label === payment.label
      );
      if (selectedPayment) {
        const data = bolt11.decode(selectedPayment.bolt11);

        let description = '';
        const descriptionTag = data.tags.find(
          tag => tag.tagName === 'description'
        );
        if (descriptionTag) {
          description = descriptionTag.data;
        }

        return (
          <View
            key={paymentRow.id}
            style={{
              width: baseSizeArc * 2,
              height: baseSizeArc * 2,
              borderRadius: (baseSizeArc * 2) / 2,
              alignItems: 'center',
              borderColor: `rgba(200,200,200,${2 / 2})`,
              borderWidth: 1,
              position: 'absolute',
            }}
          >
            {selectedIndex === 0 &&
              paymentRow.payments[0].label === selectedPayment.label &&
              this.renderSelectedPayment(selectedPayment, description)}
            {selectedIndex === 1 &&
              paymentRow.payments[1].label === selectedPayment.label &&
              this.renderSelectedPayment(selectedPayment, description)}
          </View>
        );
      }
      return null;
    }
    return (
      <View
        key={paymentRow.id}
        style={{
          width: baseSizeArc * paymentRow.id,
          height: baseSizeArc * paymentRow.id,
          borderRadius: (baseSizeArc * paymentRow.id) / 2,
          borderColor: `rgba(200,200,200,${2 / paymentRow.id})`,
          borderWidth: 1,
          position: 'absolute',
        }}
      >
        {paymentRow.payments.length >= 1 && (
          <TouchableOpacity
            onPress={() => {
              LayoutAnimation.configureNext(CustomLayoutAnimation(200));

              this.setState({
                selectedPayment: paymentRow.payments[0],
                selectedIndex: 0,
              });
            }}
            style={{
              position: 'absolute',
              width: 60,
              left: 10 + (paymentRow.id - 1) * 85,
              top: -15,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                borderRadius: 30,
                height: 60,
                width: '100%',
                backgroundColor: `rgba(100,100,100,${1 /
                  (paymentRow.id * 0.35)})`,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  fontFamily: 'QuickSand-Medium',
                  color: 'white',
                  textAlign: 'center',
                  fontSize: 12,
                }}
              >{`${paymentRow.payments[0].amount}\nsats`}</Text>
            </View>
            <Text
              numberOfLines={1}
              style={{
                fontFamily: 'QuickSand-Medium',
                color: '#888888',
                textAlign: 'center',
                fontSize: 10,
              }}
            >{`${paymentRow.payments[0].hid}`}</Text>
            <Text
              numberOfLines={1}
              style={{
                fontFamily: 'QuickSand-Medium',
                color: '#888888',
                textAlign: 'center',
                fontSize: 10,
              }}
            >{`${parseFloat(paymentRow.payments[0].dist.calculated).toFixed(
              2
            )}m away`}</Text>
          </TouchableOpacity>
        )}

        {paymentRow.payments.length >= 2 && (
          <TouchableOpacity
            onPress={() => {
              LayoutAnimation.configureNext(CustomLayoutAnimation(200));

              this.setState({
                selectedPayment: paymentRow.payments[1],
                selectedIndex: 1,
              });
            }}
            style={{
              position: 'absolute',
              width: 60,
              right: 10 + (paymentRow.id - 1) * 85,
              top: -15,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                borderRadius: 30,
                height: 60,
                width: '100%',
                backgroundColor: `rgba(100,100,100,${1 /
                  (paymentRow.id * 0.35)})`,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  fontFamily: 'QuickSand-Medium',
                  color: 'white',
                  textAlign: 'center',
                  fontSize: 12,
                }}
              >{`${paymentRow.payments[1].amount}\nsats`}</Text>
            </View>
            <Text
              numberOfLines={1}
              style={{
                fontFamily: 'QuickSand-Medium',
                color: '#888888',
                textAlign: 'center',
                fontSize: 10,
              }}
            >{`${paymentRow.payments[1].hid}`}</Text>
            <Text
              numberOfLines={1}
              style={{
                fontFamily: 'QuickSand-Medium',
                color: '#888888',
                textAlign: 'center',
                fontSize: 10,
              }}
            >{`${parseFloat(paymentRow.payments[1].dist.calculated).toFixed(
              2
            )}m away`}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  render() {
    // TODO Add unitConverter
    const ringsArray = [];
    for (let index = 1; index <= this.state.payments.length; index += 2) {
      const singleRowPayments = [];

      if (this.state.payments.length > index - 1) {
        singleRowPayments.push(this.state.payments[index - 1]);
      }
      if (this.state.payments.length > index) {
        singleRowPayments.push(this.state.payments[index]);
      }

      ringsArray.push({
        id: (index + 1) / 2,
        payments: singleRowPayments,
      });
    }

    return (
      <View>
        <Text>{this.props.visible}</Text>
        <Modal
          animationType="fade"
          visible={this.props.visible}
          onRequestClose={this.props.onRequestClose}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: 'white',
              flexDirection: 'column-reverse',
              alignItems: 'center',
            }}
          >
            <View
              style={{
                position: 'absolute',
                top: 0,
                width: '100%',
                height: '170%',
                justifyContent: 'center',
                alignItems: 'center',
                padding: 20,
              }}
            >
              {
                // [1,2,3,4,5].map((index)=><View key={index} style={{
                //     width:baseSizeArc * index,
                //     height:baseSizeArc * index,
                //     borderRadius:baseSizeArc * index/2,
                //     borderColor:`rgba(200,200,200,${(2)/index})`,
                //     borderWidth:1,
                //     position:'absolute'}}/>)
              }

              {ringsArray
                .reverse()
                .map(paymentRow => this.renderPaymentRow(paymentRow))}

              <View
                style={{
                  position: 'absolute',
                  paddingTop: 20,
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    color: '#444444',
                    fontSize: 12,
                    fontFamily: 'QuickSand-Medium',
                  }}
                >
                  {ringsArray.length > 0
                    ? 'Tap on a circle to pay'
                    : 'No nearby invoices found'}
                </Text>
              </View>
            </View>
            <View
              style={{
                flexDirection: 'row',
                paddingHorizontal: 40,
                justifyContent: 'space-between',
              }}
            >
              <TouchableOpacity
                style={{ marginBottom: 30 }}
                onPress={() => {
                  if (this.state.selectedPayment) {
                    LayoutAnimation.configureNext(CustomLayoutAnimation(200));

                    this.setState({ selectedPayment: null });
                  } else {
                    this.props.onRequestClose();
                  }
                }}
              >
                <View
                  style={{
                    borderRadius: 20,
                    backgroundColor: '#DDDDDD',
                    padding: 10,
                    paddingHorizontal: 15,
                  }}
                >
                  <Text
                    style={{ color: 'black', fontFamily: 'QuickSand-Medium' }}
                  >
                    Back
                  </Text>
                </View>
              </TouchableOpacity>
              {this.state.selectedPayment && (
                <TouchableOpacity
                  style={{ marginBottom: 30 }}
                  onPress={() => {
                    this.payInvoice().done();
                  }}
                >
                  <View
                    style={{
                      borderRadius: 20,
                      backgroundColor: '#333333',
                      padding: 10,
                      paddingHorizontal: 15,
                      marginLeft: 20,
                    }}
                  >
                    <Text
                      style={{ color: 'white', fontFamily: 'QuickSand-Medium' }}
                    >
                      Confirm
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>
          </View>
          <DropdownAlert ref={d => (this.dropdownAlert = d)} />
        </Modal>
      </View>
    );
  }
}
