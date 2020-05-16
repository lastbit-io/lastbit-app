import React, { Component } from 'react'
import { Text, View } from 'react-native'

import { ThemeContext } from 'theme-manager'
import generateStyleSheet from './style'

var style = false;

export default class StatTile extends Component {
    static contextType = ThemeContext;
    render() {
        let themeObj = this.context
        if(!style){
            style = themeObj.createStyle(generateStyleSheet, "Stat Tile");
        } 
        return (
            <View style={[style.tileContainer, this.props.styles]}>
                <Text style={style.titleText}>{this.props.title}</Text>
                <Text style={style.tileMainTextContent}>{this.props.mainText}</Text>
                <Text style={style.subtitleText}>{this.props.subtitle}</Text>
            </View>
        )
    }
}
