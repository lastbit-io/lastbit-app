import React, { Component } from 'react';
import { Text, View, TouchableHighlight, TouchableOpacity } from 'react-native';
import { Animate } from 'react-move';
import { easeLinear } from 'd3-ease';
import { Col, Row, Grid } from 'react-native-easy-grid';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Sentry } from 'react-native-sentry';
import { UnitContext } from 'unit-manager';
import Mixpanel from 'react-native-mixpanel';

import styles from './style';
import colors from './colors';

export default class SimpleLightningInvoice extends Component {
  static contextType = UnitContext;

  constructor(props) {
    super(props);
    this.state = {
      price: '',
      textButtonSelected: '',
      colorDelete: this.props.styleDeleteButtonColorHideUnderlay
        ? this.props.styleDeleteButtonColorHideUnderlay
        : 'rgb(211, 213, 218)',
    };
  }

  renderButtonNumber = text => {
    const disabled = false; // TODO if creating invoice = true
    return (
      <Animate
        show
        start={{
          opacity: 1,
        }}
        update={{
          timing: { duration: 200, ease: easeLinear },
        }}
      >
        {({ opacity }) => (
          <TouchableHighlight
            style={[
              this.props.styleButtonCircle
                ? this.props.styleButtonCircle
                : styles.buttonCircle,
              {
                backgroundColor: this.props.colorCircleButtons
                  ? this.props.colorCircleButtons
                  : 'rgb(242, 245, 251)',
              },
            ]}
            underlayColor={
              this.props.numbersButtonOverlayColor
                ? this.props.numbersButtonOverlayColor
                : colors.turquoise
            }
            disabled={disabled}
            onShowUnderlay={() => this.setState({ textButtonSelected: text })}
            onHideUnderlay={() => this.setState({ textButtonSelected: '' })}
            onPress={() => {
              this.onPressButtonNumber(text);
            }}
          >
            <Text
              style={[
                this.props.styleTextButton
                  ? this.props.styleTextButton
                  : styles.text,
                {
                  opacity,
                  color:
                    this.state.textButtonSelected === text
                      ? this.props.styleColorButtonTitleSelected
                        ? this.props.styleColorButtonTitleSelected
                        : colors.white
                      : this.props.styleColorButtonTitle
                      ? this.props.styleColorButtonTitle
                      : colors.grey,
                },
              ]}
            >
              {text}
            </Text>
          </TouchableHighlight>
        )}
      </Animate>
    );
  };

  renderButtonDelete = opacity => (
    <TouchableHighlight
      disabled={this.state.price.length === 0}
      underlayColor="transparent"
      style={{ flex: 2, marginLeft: 6, paddingTop: 20 }}
      onHideUnderlay={() =>
        this.setState({
          colorDelete: this.props.styleDeleteButtonColorHideUnderlay
            ? this.props.styleDeleteButtonColorHideUnderlay
            : 'rgb(211, 213, 218)',
        })
      }
      onShowUnderlay={() =>
        this.setState({
          colorDelete: this.props.styleDeleteButtonColorShowUnderlay
            ? this.props.styleDeleteButtonColorShowUnderlay
            : colors.turquoise,
        })
      }
      onPress={() => {
        if (this.state.price.length > 0) {
          const newPrice = this.state.price.slice(0, -1);
          this.setState({ price: newPrice });
        }
      }}
    >
      <View
        style={
          this.props.styleColumnDeleteButton
            ? this.props.styleColumnDeleteButton
            : styles.colIcon
        }
      >
        {!this.props.iconButtonDeleteDisabled && (
          <Icon
            name={
              this.props.styleDeleteButtonIcon
                ? this.props.styleDeleteButtonIcon
                : 'backspace'
            }
            size={
              this.props.styleDeleteButtonSize
                ? this.props.styleDeleteButtonSize
                : 30
            }
            color={this.state.colorDelete}
            style={{ opacity }}
          />
        )}
        <Text
          style={[
            this.props.styleDeleteButtonText
              ? this.props.styleDeleteButtonText
              : styles.textDeleteButton,
            { color: this.state.colorDelete, opacity },
          ]}
        >
          {/* {this.props.buttonDeleteText
                            ? this.props.buttonDeleteText
                            : 'delete'} */}
        </Text>
      </View>
    </TouchableHighlight>
  );

  chargeAction = () => {
    const price = parseFloat(this.state.price);
    if (price > 0) {
      this.props.onChargeSuccess(price);
    } else {
      Mixpanel.track(
        `Lightning Invoice Error: minimum amount is 1 ${this.context.unit.displayName}`
      );
      window.EventBus.trigger('showDropdownAlert', {
        type: 'error',
        title: 'Invalid Amount',
        message: `The minimum amount you may create a bill for is 1 ${this.context.unit.displayName}`,
      });
    }
  };

  onPressButtonNumber = async text => {
    let currentprice = this.state.price + text;
    const numberOfDecimals = (currentprice.match(/[.]/g) || []).length;
    if (numberOfDecimals > 0) {
      if (numberOfDecimals > 1) {
        Mixpanel.track(
          `Lightning Invoice Error: no two decimal points in same number`
        );
        window.EventBus.trigger('showDropdownAlert', {
          type: 'error',
          title: 'Invalid amount',
          message: 'Cannot have two decimal points in same number!',
        });
        return;
      }
      if (currentprice.split('.')[1].length > 2)
        currentprice = currentprice.slice(0, -1);
    }
    if (parseFloat(currentprice) > 50) {
      Mixpanel.track(
        `Lightning Invoice Error: maximum amount is 50 ${this.context.unit.displayName}`
      );
      window.EventBus.trigger('showDropdownAlert', {
        type: 'error',
        title: 'Exceeds limit',
        message: `The maximum amount you may create a bill for is 50 ${this.context.unit.displayName}`,
      });
      this.setState({ price: '' });
      return;
    }

    this.setState({ price: currentprice });
  };

  render() {
    return (
      <View>
        <View
          style={{
            marginVertical: 40,
            alignItems: 'center',
            flexDirection: 'row',
          }}
        >
          <Text style={styles.currencySymbolText}>
            {this.props.selectedCurrencySymbol}
          </Text>
          <Text style={styles.priceText}>{this.state.price}</Text>
          {this.state.price.length > 0 && this.renderButtonDelete()}
        </View>
        <Grid style={styles.grid}>
          <Row
            style={
              this.props.styleRowButtons
                ? this.props.styleRowButtons
                : styles.row
            }
          >
            {[1, 2, 3].map(i => (
              <Col
                key={i}
                style={
                  this.props.styleColumnButtons
                    ? this.props.styleColumnButtons
                    : styles.colButtonCircle
                }
              >
                {this.props.buttonNumberComponent
                  ? this.props.buttonNumberComponent(
                      i,
                      this.onPressButtonNumber
                    )
                  : this.renderButtonNumber(i.toString())}
              </Col>
            ))}
          </Row>
          <Row
            style={
              this.props.styleRowButtons
                ? this.props.styleRowButtons
                : styles.row
            }
          >
            {[4, 5, 6].map(i => (
              <Col
                key={i}
                style={
                  this.props.styleColumnButtons
                    ? this.props.styleColumnButtons
                    : styles.colButtonCircle
                }
              >
                {this.props.buttonNumberComponent
                  ? this.props.buttonNumberComponent(
                      i,
                      this.onPressButtonNumber
                    )
                  : this.renderButtonNumber(i.toString())}
              </Col>
            ))}
          </Row>
          <Row
            style={
              this.props.styleRowButtons
                ? this.props.styleRowButtons
                : styles.row
            }
          >
            {[7, 8, 9].range(7, 10).map(i => (
              <Col
                key={i}
                style={
                  this.props.styleColumnButtons
                    ? this.props.styleColumnButtons
                    : styles.colButtonCircle
                }
              >
                {this.props.buttonNumberComponent
                  ? this.props.buttonNumberComponent(
                      i,
                      this.onPressButtonNumber
                    )
                  : this.renderButtonNumber(i.toString())}
              </Col>
            ))}
          </Row>
          <Row
            style={
              this.props.styleRowButtons
                ? this.props.styleRowButtons
                : styles.row
            }
          >
            <Col
              style={
                this.props.styleColumnButtons
                  ? this.props.styleColumnButtons
                  : styles.colButtonCircle
              }
            >
              {this.renderButtonNumber('.')}
            </Col>
            <Col
              style={
                this.props.styleColumnButtons
                  ? this.props.styleColumnButtons
                  : styles.colButtonCircle
              }
            >
              {this.props.buttonNumberComponent
                ? this.props.buttonNumberComponent(
                    '0',
                    this.onPressButtonNumber
                  )
                : this.renderButtonNumber('0')}
            </Col>
            <Col
              style={
                this.props.styleColumnButtons
                  ? this.props.styleColumnButtons
                  : styles.colButtonCircle
              }
            >
              <TouchableOpacity onPress={this.chargeAction}>
                <Icon name="check-circle" size={64} color="#129793" />
              </TouchableOpacity>
            </Col>
          </Row>
        </Grid>
      </View>
    );
  }
}
