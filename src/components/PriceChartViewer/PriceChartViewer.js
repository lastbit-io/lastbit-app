import React, { Component } from 'react';
import PropTypes from 'prop-types';
import {
  View,
  TouchableOpacity,
  Image,
  Text,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import {
  VictoryChart,
  VictoryAxis,
  VictoryTheme,
  VictoryCandlestick,
  VictoryTooltip,
  VictoryVoronoiContainer,
} from 'victory-native';
import moment from 'moment';
import Reactotron from 'reactotron-react-native';
import Mixpanel from 'react-native-mixpanel';

import { ThemeConsumer } from 'theme-manager';
import StatTile from 'stat-tile';
import ProvideCombinedContext, { CombinedContext } from 'state-manager';
import Sentry from 'react-native-sentry';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import generateStyleSheet from './style';
import CustomWebView from '../CustomWebView';

const btcImage = require('../../../assets/images/btc.png');

const { width } = Dimensions.get('window');

let style = false;

const currencies = [
  { name: 'USD', symbol: '$' },
  { name: 'EUR', symbol: '€' },
  { name: 'GBP', symbol: '£' },
];

const timeName = ['1H', '1D', '1W', '1M', '1Y'];

const BarText = ({ onPress, name, textStyle, styles }) => (
  <TouchableOpacity style={styles} onPress={onPress}>
    <Text style={textStyle}>{name}</Text>
  </TouchableOpacity>
);

class PriceChartViewer extends Component {
  static contextType = CombinedContext;

  static propTypes = {
    coinName: PropTypes.string,
    coinImagePath: PropTypes.string,
  };

  static defaultProps = {
    coinName: 'Bitcoin',
    coinImagePath: '../../../assets/images/btc.png',
  };

  constructor(props) {
    super(props);
    this.state = {
      btnSelected: '1W',
      chartContainerHeight: null,
      chartContainerWidth: null,
      currency: this.props.currency,
      currencyAmount: this.props.coinPrice,
      currencyIndex: 0,
      coinDelta: this.props.coinDelta,
      viewMode: 'priceChart',
    };
  }

  componentDidMount() {
    this.changeTimeWindow('1W');
    let currencyIndex = 0;

    currencies.forEach((value, index) => {
      if (value.name === this.props.currency.name) {
        currencyIndex = index;
      }
    });

    this.setState({
      currencyIndex,
    });
  }

  renderHeader = () => (
    <View
      style={{
        ...style.sendHeader,
        paddingHorizontal: 20,
        justifyContent: 'space-between',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <TouchableOpacity
          style={style.backImageContainer}
          onPress={this.props.onBackPressed}
        >
          <Image
            style={style.backImage}
            source={require('../../../assets/images/back.png')}
          />
        </TouchableOpacity>
        <View>
          <Text style={style.deviceTitleText}>
            {this.context.translate('marketsTitle')}
          </Text>
        </View>
      </View>
      {/* <TouchableOpacity
        onPress={() => {
          Mixpanel.track('HomeScreen Buy Bitcoin Pressed');
          this.setState({ viewMode: 'webview' });
        }}
        style={{
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <MaterialCommunityIcons
          name="cart-outline"
          size={28}
          color={this.context.theme.COLOR_INFO}
        />
        <Text style={[style.deviceTitleText, { fontSize: 11 }]}>
          {this.context.translate('buyBitcoin')}
        </Text>
      </TouchableOpacity> */}
    </View>
  );

  renderWebView = () => (
    <>
      <View
        style={{
          ...style.sendHeader,
          width,
          height: 50,
          backgroundColor: '#FFF',
          alignItems: 'center',
          marginTop: 10,
        }}
      >
        <TouchableOpacity
          style={style.backImageContainer}
          onPress={() => {
            this.setState({ viewMode: 'priceChart' });
          }}
        >
          <Image
            style={style.backImage}
            source={require('../../../assets/images/back.png')}
          />
        </TouchableOpacity>
        <View>
          <Text style={style.deviceTitleText}>
            {this.context.translate('buyBitcoin')}
          </Text>
        </View>
      </View>
      <CustomWebView
        style={this.props.homescreenstyle}
        receivingAddress={this.props.receivingAddress}
      />
    </>
  );

  _getHistoricalPrice = async timeDim => {
    // https://min-api.cryptocompare.com/documentation?key=Historical&cat=dataHistoday
    const { currency } = this.state;
    let cryptoCompareUrl;
    switch (timeDim) {
      case '1H':
        cryptoCompareUrl = `https://min-api.cryptocompare.com/data/histominute?fsym=BTC&tsym=${currency.name}&limit=30&aggregate=2`;
        break;
      case '1D':
        cryptoCompareUrl = `https://min-api.cryptocompare.com/data/histohour?fsym=BTC&tsym=${currency.name}&limit=24`;
        break;
      case '1W':
        cryptoCompareUrl = `https://min-api.cryptocompare.com/data/histohour?fsym=BTC&tsym=${currency.name}&limit=28&aggregate=6`;
        break;
      case '1M':
        cryptoCompareUrl = `https://min-api.cryptocompare.com/data/histoday?fsym=BTC&tsym=${currency.name}&limit=30`;
        break;
      case '1Y':
        cryptoCompareUrl = `https://min-api.cryptocompare.com/data/histoday?fsym=BTC&tsym=${currency.name}&limit=28&aggregate=15`;
        break;
      default:
        break;
    }

    try {
      const response = await fetch(cryptoCompareUrl);
      const responseJson = await response.json();
      const currencyResponse = await fetch(
        `https://min-api.cryptocompare.com/data/generateAvg?fsym=BTC&tsym=${currency.name}&e=Kraken`
      );
      const currencyResponseJson = await currencyResponse.json();
      const currencyAmount = currencyResponseJson.RAW.PRICE;
      const chartData = responseJson.Data;
      this.calculateCoinDelta(
        chartData[0].open,
        currencyResponseJson.RAW.PRICE
      );
      chartData.map(e => (e.time = `${moment.unix(e.time).format()}`));
      Reactotron.log('chartData', chartData);
      this.calcHigh(chartData);
      this.calcLow(chartData);
      this.setState({
        fetching: false,
        chartData,
        currencyAmount,
      });
    } catch (error) {
      Sentry.captureException(error);
      console.error(error);
    }
  };

  calcHigh(chartData) {
    const high = Math.max.apply(
      Math,
      chartData.map(function(o) {
        return o.high;
      })
    );
    this.setState({ high });
  }

  calcLow(chartData) {
    const low = Math.min.apply(
      Math,
      chartData.map(function(o) {
        return o.low;
      })
    );
    this.setState({ low });
  }

  changeTimeWindow(selectedDim) {
    this.setState({ btnSelected: selectedDim, fetching: true });
    this._getHistoricalPrice(selectedDim);
  }

  changeCurrency = () => {
    const { btnSelected, currencyIndex } = this.state;

    Mixpanel.trackWithProperties('Market Change Currency', {
      currency: currencies[currencyIndex + 1],
    });

    if (currencyIndex < 2) {
      this.setState(
        {
          currencyIndex: currencyIndex + 1,
          currency: currencies[currencyIndex + 1],
        },
        () => {
          this.changeTimeWindow(btnSelected);
        }
      );
    } else {
      this.setState(
        {
          currencyIndex: 0,
          currency: currencies[0],
        },
        () => {
          this.changeTimeWindow(btnSelected);
        }
      );
    }
  };

  calculateCoinDelta = (openPrice, currentPrice) => {
    const change = currentPrice - openPrice;
    const coinDelta = (change / openPrice) * 100;
    this.setState({
      coinDelta: coinDelta.toFixed(2),
    });
  };

  renderPriceChartViewer = () => {
    const { currency, currencyAmount, btnSelected } = this.state;
    return (
      <ThemeConsumer>
        {themeObj => {
          if (!style || themeObj.themeChanged) {
            style = themeObj.createStyle(
              generateStyleSheet,
              'Price Chart Viewer'
            );
          }
          return (
            <View style={{ flex: 1, paddingTop: 20, paddingBottom: 20 }}>
              {this.renderHeader()}
              <View style={{ flex: 1 }}>
                <View style={{ paddingHorizontal: 20 }}>
                  <View
                    style={{
                      paddingTop: 20,
                      alignItems: 'center',
                      flexDirection: 'row',
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={style.coinTitle}>{this.props.coinName}</Text>
                      <Text
                        style={[
                          style.coinDelta,
                          this.state.coinDelta > 0
                            ? style.positiveChange
                            : style.negativeChange,
                        ]}
                      >
                        {!this.state.fetching
                          ? `${this.state.coinDelta} % (${btnSelected})`
                          : '...'}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={this.changeCurrency}>
                      <Text style={style.coinTitle}>
                        {!this.state.fetching
                          ? `${currency.symbol}${currencyAmount}`
                          : '...'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
                {this.state.chartData && !this.state.fetching ? (
                  <View
                    style={{ ...style.chartWrapper, paddingLeft: 30 }}
                    on
                    onLayout={event => {
                      this.setState({
                        chartContainerHeight: event.nativeEvent.layout.height,
                        chartContainerWidth: event.nativeEvent.layout.width,
                      });
                    }}
                  >
                    {
                      <VictoryChart
                        theme={VictoryTheme.material}
                        width={Dimensions.get('screen').width + 10}
                        scale={{ x: 'time' }}
                        containerComponent={
                          <VictoryVoronoiContainer voronoiDimension="x" />
                        }
                        minDomain={{ x: 0 }}
                      >
                        <VictoryAxis
                          // offsetX={50}
                          dependentAxis
                          style={{
                            axis: { stroke: `${themeObj.theme.PRIMARY_COLOR}` },
                            ticks: {
                              stroke: `${themeObj.theme.PRIMARY_COLOR}`,
                              size: 5,
                            },
                            grid: {
                              stroke: `${themeObj.theme.MUTED_COLOR}`,
                              opacity: 0.5,
                            },
                          }}
                        />
                        <VictoryAxis
                          scale={{ x: 'time' }}
                          style={{
                            axis: { stroke: `${themeObj.theme.PRIMARY_COLOR}` },
                            axisLabel: { fontSize: 16 },
                            ticks: {
                              stroke: `${themeObj.theme.PRIMARY_COLOR}`,
                            },
                            grid: {
                              stroke: `transparent`,
                            },
                            tickLabels: {
                              fontSize: 6.5,
                              padding: 5,
                              angle: 0,
                              verticalAnchor: 'middle',
                              textAnchor: 'start',
                              fill: `${themeObj.theme.PRIMARY_COLOR}`,
                            },
                          }}
                          data={this.state.chartData}
                          tickValues={this.state.chartData.map(tx => tx.time)}
                          tickCount={6}
                          tickFormat={(t, index, ticks) => {
                            let tickFormat = 'DD-MM-YYYY, h:mm a';
                            switch (this.state.btnSelected) {
                              case '1H':
                                tickFormat = 'hh:mm';
                                break;
                              case '1D':
                                tickFormat = 'hh:mm';
                                break;
                              case '1W':
                                tickFormat = 'MMM DD';
                                break;
                              case '1M':
                                tickFormat = 'MMM DD';
                                break;
                              case '1Y':
                                tickFormat = 'MMM DD';
                                break;
                              default:
                                break;
                            }
                            return moment(moment(t).format()).format(
                              tickFormat
                            );
                          }}
                        />
                        <VictoryCandlestick
                          candleColors={{
                            positive: `${themeObj.theme.COLOR_SUCCESS}`,
                            negative: `${themeObj.theme.COLOR_ERROR}`,
                          }}
                          candleRatio={0.8}
                          data={this.state.chartData}
                          labelComponent={
                            <VictoryTooltip
                              cornerRadius={0}
                              flyoutStyle={{ fill: 'white' }}
                            />
                          }
                          labels={d => {
                            Reactotron.log(d);
                            return `Date: ${moment(d.time).format(
                              'MMM Do YYYY, hh:mm'
                            )}${`\n`}Amount: ${currency.symbol}${Math.round(
                              d.open
                            )}`;
                          }}
                        />
                      </VictoryChart>
                    }
                  </View>
                ) : (
                  <View
                    style={{
                      flex: 1,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <ActivityIndicator size="large" color="black" />
                  </View>
                )}
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-evenly',
                  }}
                >
                  <StatTile
                    title={this.context.translate('high')}
                    mainText={
                      this.state.high && !this.state.fetching
                        ? `${this.state.high} ${currency.symbol}`
                        : '...'
                    }
                  />
                  <StatTile
                    title={this.context.translate('low')}
                    mainText={
                      this.state.low && !this.state.fetching
                        ? `${this.state.low} ${currency.symbol}`
                        : '...'
                    }
                  />
                </View>
                <View
                  style={[
                    style.bar,
                    {
                      width: width - 20,
                    },
                  ]}
                >
                  {timeName.map((item, index) => (
                    <BarText
                      key={index}
                      onPress={() => this.changeTimeWindow(item)}
                      textStyle={
                        this.state.btnSelected === item
                          ? { fontFamily: 'Quicksand-Bold', fontSize: 18 }
                          : {
                              fontFamily: 'Quicksand-Regular',
                              color: '#FFF',
                              fontSize: 18,
                            }
                      }
                      name={item}
                      styles={
                        this.state.btnSelected === item
                          ? { ...style.btnSelected, ...style.btnUnselected }
                          : style.btnUnselected
                      }
                    />
                  ))}
                </View>
              </View>
            </View>
          );
        }}
      </ThemeConsumer>
    );
  };

  render() {
    const { viewMode } = this.state;
    return (
      <View
        style={{
          flex: 1,
          padding: 0,
          backgroundColor: '#FFF',
        }}
      >
        {viewMode === 'priceChart' && this.renderPriceChartViewer()}
        {viewMode === 'webview' && this.renderWebView()}
      </View>
    );
  }
}

const ContextWrappedComponent = props => (
  <ProvideCombinedContext>
    <PriceChartViewer {...props} />
  </ProvideCombinedContext>
);

export default ContextWrappedComponent;
