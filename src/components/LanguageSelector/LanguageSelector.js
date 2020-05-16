import React, { Component } from 'react';
import { Text, View, Picker, ActionSheetIOS, TouchableOpacity, Platform } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { LanguageContext } from 'state-manager';

export default class LanguageSelector extends Component {
    static contextType = LanguageContext;

    render() {
        const { translate, changeLanguage, languages } = this.context;

        if (Platform.OS === 'android')
            return (
                <Picker
                    selectedValue={translate('langShortCode')}
                    onValueChange={value => changeLanguage(value)}
                    style={this.props.style ? this.props.style : { height: 45, width: 135 }}
                    itemStyle={{ color: 'black' }}
                >
                    {languages.map((language, index) => (
                        <Picker.Item
                            key={index}
                            value={language.shortCode}
                            label={language.displayName}
                        />
                    ))}
                </Picker>
            )
        else return (
            <View
                style={{
                    flexDirection: 'row',
                    justifyContent: 'space-around',
                    alignItems: 'center',
                }}
            >
                <Text
                    style={{
                        marginLeft: 10,
                    }}
                >
                    {translate('lang')}
                </Text>
                <TouchableOpacity
                    onPress={() => {
                        ActionSheetIOS.showActionSheetWithOptions(
                            {
                                options: [
                                    ...languages.map(item => item.displayName),
                                    'Cancel',
                                ],
                                cancelButtonIndex: 3,
                            },
                            buttonIndex => {
                                if (buttonIndex !== 3) {
                                    changeLanguage(languages[buttonIndex]);
                                }
                            }
                        );
                    }}
                >
                    <MaterialIcons name="arrow-drop-down" size={30} />
                </TouchableOpacity>
            </View>
        )
    }
}
