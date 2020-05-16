import React, { Component } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import ProvideCombinedContext, { CombinedContext } from 'state-manager';
import Reactotron from 'reactotron-react-native';

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  tabContainer: {
    flexDirection: 'row',
    width,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
  },
});

class CustomTabBar extends Component {
  static contextType = CombinedContext;

  render() {
    const { navigation } = this.props;
    const { translate, theme } = this.context;
    const icons = ['ios-flash', 'logo-bitcoin', 'ios-settings'];

    const titles = [translate('lightning'), 'Bitcoin', translate('settings')];
    const { routes, index } = navigation.state;

    return (
      <View style={styles.tabContainer}>
        {routes.map((route, idx) => {
          const color = index === idx ? theme.COLOR_INFO : theme.MUTED_COLOR;
          return (
            <TouchableOpacity
              onPress={() => {
                navigation.navigate(route.routeName);
              }}
              style={[styles.tab, { backgroundColor: '#fff' }]}
              key={route.routeName}>
              <Icon
                style={{ margin: 5 }}
                size={20}
                color={color}
                name={icons[idx]}
              />
              <Text style={{ color, fontSize: 10, marginBottom: 5 }}>
                {titles[idx]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }
}

const ContextWrappedComponent = props => (
  <ProvideCombinedContext>
    <CustomTabBar {...props} />
  </ProvideCombinedContext>
);

export default ContextWrappedComponent;
