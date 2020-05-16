import React, { Component } from 'react';
import {
  View,
  Modal,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  Clipboard,
  Share,
  Image,
  SafeAreaView,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import moment from 'moment';
import LightningManager from 'lightning-manager';
import Reactotron from 'reactotron-react-native';
import ProvideCombinedContext, { CombinedContext } from 'state-manager';
import DropdownAlert from 'react-native-dropdownalert';
import bolt11 from 'bolt11';
import style from './style';

/*
Online htlc wallet: 911fcfae-4e6a-46df-a031-9451f578f77c
*/

class ReceiveLightningPayment extends Component {
  static contextType = CombinedContext;

  constructor(props) {
    super(props);
  }

  state = {
    timerInSec: 0,
  };

  componentDidMount() {
    this.paymentReported = false;

    const expireAt = moment(this.props.expiresAt * 1000);
    const currentTime = moment();
    const timeDiffInSecond = expireAt.diff(currentTime, 'seconds');
    this.setState({
      timerInSec: timeDiffInSecond,
    });
    this.poller = setInterval(() => {
      this.getInvoiceStatus().done();
    }, 2000);

    this.timerInterval = setInterval(() => {
      const { timerInSec } = this.state;
      if (timerInSec > 0) {
        this.setState({
          timerInSec: timerInSec - 1,
        });
      } else {
        this.props.onRequestClose();
      }
    }, 1000);
  }

  getInvoiceStatus = async () => {
    const invoices = await LightningManager.getUserInvoices();
    if (invoices) {
      const invoice = invoices.find(
        fetchedInvoice => fetchedInvoice.label === this.props.label
      );
      if (!invoice) {
        this.props.onRequestClose();
        return;
      }
      if (invoice.ispaid && this.paymentReported === false) {
        this.paymentReported = true;
        Reactotron.log('INVOICE PAID CALLED');
        this.props.invoicePaid();
      }
    }
  };

  componentWillUnmount() {
    clearInterval(this.poller);
    clearInterval(this.timerInterval);
  }

  render() {
    const { translate } = this.context;
    const { timerInSec } = this.state;
    Reactotron.log(this.props);
    const duration = moment.duration(timerInSec, 'seconds');
    return (
      <Modal
        visible={this.props.visible}
        transparent
        animationType="fade"
        onRequestClose={this.props.onRequestClose}
      >
        <SafeAreaView
          style={{
            backgroundColor: 'rgba(0,0,0,0.9)',
            flex: 1,
            padding: 20,
            paddingTop: 10,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <View
            style={{ flexDirection: 'row', width: '100%', paddingBottom: 10 }}
          >
            <TouchableOpacity
              style={{ padding: 10 }}
              onPress={this.props.onRequestClose}
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
          </View>
          <Text style={style.titleText}>{this.props.invoiceAmount}</Text>
          <Text style={style.subTitleText}>
            {this.context.unit.displayName === 'Satoshis'
              ? `(${bolt11.decode(this.props.bolt11).satoshis / 100000000} BTC)`
              : `(${bolt11.decode(this.props.bolt11).satoshis} sats)`}
          </Text>
          <Text style={{ ...style.subTitleText, marginVertical: 20 }}>
            {translate('receiveLNPayTitle')}
          </Text>
          <View style={{ flexDirection: 'row' }}>
            <TouchableOpacity
              style={style.actionBtn}
              onPress={() => {
                this.dropdownAlert.alertWithType(
                  'success',
                  translate('successCopyTitle'),
                  translate('successCopyInvoiceMsg')
                );
                Clipboard.setString(this.props.bolt11);
              }}
            >
              <Text style={style.textRegular}>{translate('copy')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ ...style.actionBtn, marginLeft: 10 }}
              onPress={() => {
                Share.share({
                  message: this.props.bolt11,
                });
              }}
            >
              <Text style={style.textRegular}>{translate('share')}</Text>
            </TouchableOpacity>
          </View>
          <View style={{ padding: 10, backgroundColor: 'white' }}>
            <QRCode value={this.props.bolt11} size={200} />
          </View>
          <Text style={{ ...style.textRegular, marginTop: 10 }}>{`${translate(
            'validUntil'
          )}: ${moment(this.props.expiresAt * 1000).format(
            'hh[:]mm a[, ]DD MMMM YYYY'
          )}`}</Text>
          <Text style={[style.subTitleText, { marginTop: 40 }]}>
            {`0${duration.minutes()} : ${
              duration.seconds() >= 10
                ? duration.seconds()
                : `0${duration.seconds()}`
            }`}
          </Text>
          <Text
            style={{ ...style.textRegular, marginTop: 5, color: 'orange' }}
          >{`${translate('waitingForPayment')}...`}</Text>
          <View style={{ flex: 1 }} />
          <DropdownAlert ref={d => (this.dropdownAlert = d)} />
        </SafeAreaView>
      </Modal>
    );
  }
}

const ContextWrappedComponent = props => (
  <ProvideCombinedContext>
    <ReceiveLightningPayment {...props} />
  </ProvideCombinedContext>
);

export default ContextWrappedComponent;
