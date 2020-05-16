import React, { Component } from 'react'
import PropTypes from 'prop-types'

import { View } from 'react-native'

export default class ColorThemeDynaIcon extends Component {
    static propTypes = {
        theme: PropTypes.object.isRequired,
    }

    render() {
        return (
            <View style={{
                transform: [
                    { rotateZ: '180deg' },
                    { scale: 0.25 },
                    { translateY: -90 },
                    { translateX: 140 }
                ]
            }}>
                <View style={{
                    width: 100,
                    height: 100,
                    backgroundColor: this.props.theme.SECONDARY_BACKGROUND_COLOR,
                    borderColor: this.props.theme.PRIMARY_BACKGROUND_COLOR,
                    borderTopWidth: 2,
                    borderLeftWidth: 2,
                    borderBottomWidth: 50,
                    borderRightWidth: 2,
                    borderRadius: 50,
                }} />
                <View style={{
                    position: 'absolute',
                    top: 24,
                    left: 0,
                    borderColor: this.props.theme.PRIMARY_BACKGROUND_COLOR,
                    borderWidth: 24,
                    borderRadius: 30,
                }} />
                <View style={{
                    position: 'absolute',
                    top: 24,
                    right: 2,
                    borderColor: this.props.theme.SECONDARY_BACKGROUND_COLOR,
                    borderWidth: 25,
                    borderRadius: 30,
                }} />
                <View style={{
                    position: 'absolute',
                    top: 22,
                    right: 2,
                    backgroundColor: this.props.theme.SECONDARY_BACKGROUND_COLOR,
                    borderColor: this.props.theme.SECONDARY_BACKGROUND_COLOR,
                    borderWidth: 25,
                    borderRadius: 30,
                }} />
            </View>
        )
    }
}
