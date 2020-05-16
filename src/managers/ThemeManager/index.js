import React, { Component } from 'react';
import AsyncStorage from '@react-native-community/async-storage';
import Reactotron from 'reactotron-react-native';
import * as themes from '../../themes';

import { ThemeContext } from '../StateManager/Contexts';

export class ThemeProvider extends Component {
  constructor(props) {
    super(props);

    this.componentDidMount = () => {
      this.loadTheme();
    };

    this.loadTheme = async () => {
      // let themePresent = await AsyncStorage.getItem('activeTheme');
      // Reactotron.log('themeLoader', themePresent);
      if (!themePresent) {
        // Set default theme
        await AsyncStorage.setItem(
          'activeTheme',
          JSON.stringify(themes.standard)
        );
        this.setState({ theme: themes.standard });
      } else {
        this.setState({ theme: JSON.parse(themePresent) });
      }
    };

    this.changeTheme = async theme => {
      if (theme) {
        if (this.state.theme == theme) {
          // Invert colors onclick same theme
          const primCol = theme.PRIMARY_COLOR;
          const secCol = theme.SECONDARY_COLOR;
          const primBgCol = theme.PRIMARY_BACKGROUND_COLOR;
          const secBgCol = theme.SECONDARY_BACKGROUND_COLOR;
          const primLSCol = theme.PRIMARY_LIST_SEPARATOR_COLOR;
          const secLSCol = theme.SECONDARY_LIST_SEPARATOR_COLOR;
          const inpConCol = theme.INPUT_CONTAINER_COLOR;
          const inpConInvCol = theme.INPUT_CONTAINER_INVERT_COLOR;
          const accCol = theme.ACCENTED_COLOR;
          const muteCol = theme.MUTED_COLOR;
          const themeInvert = {
            ...this.state.theme,
            PRIMARY_COLOR: secCol,
            SECONDARY_COLOR: primCol,
            PRIMARY_BACKGROUND_COLOR: secBgCol,
            SECONDARY_BACKGROUND_COLOR: primBgCol,
            MUTED_COLOR: accCol,
            ACCENTED_COLOR: muteCol,
            PRIMARY_LIST_SEPARATOR_COLOR: secLSCol,
            SECONDARY_LIST_SEPARATOR_COLOR: primLSCol,
            INPUT_CONTAINER_COLOR: inpConInvCol,
            INPUT_CONTAINER_INVERT_COLOR: inpConCol,
          };
          this.setState({
            theme: themeInvert,
            themeChanged: true,
          });
          await AsyncStorage.setItem(
            'activeTheme',
            JSON.stringify(themeInvert)
          );
        } else {
          this.setState({ theme, themeChanged: true });
          await AsyncStorage.setItem('activeTheme', JSON.stringify(theme));
        }
      } else return this.state.theme;
    };

    // TODO: Custom Styles
    this.createStyle = (generateStyleSheet, screenName) => {
      // Reactotron.log('Creating stylesheet: ' + screenName)
      return generateStyleSheet(this.state.theme);
    };

    this.state = {
      theme: themes.standard,
      changeTheme: this.changeTheme,
      createStyle: this.createStyle,
      loadTheme: this.loadTheme,
      themeChanged: false,
    };
  }

  render() {
    return (
      <ThemeContext.Provider value={this.state}>
        {this.props.children}
      </ThemeContext.Provider>
    );
  }
}

export const ThemeConsumer = ThemeContext.Consumer;
export { ThemeContext };
