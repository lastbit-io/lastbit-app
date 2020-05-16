/* eslint-disable */
import AsyncStorage from '@react-native-community/async-storage';
import React, { Component } from 'react';
import RNRestart from "react-native-restart";
import i18n from './i18n';
import { LanguageContext, languages } from '../StateManager/Contexts';
import Reactotron from 'reactotron-react-native';

export class LanguageProvider extends Component {
    constructor(props) {
        super(props);

        this.componentDidMount = () => {
            this.loadLanguage();
        }

        this.loadLanguage = async () => {
            let selectedLanguage = await AsyncStorage.getItem('lang');
            if (!selectedLanguage) {
                Reactotron.log('Set default Language: English (en)');
                await AsyncStorage.setItem('lang', JSON.stringify(languages[0]))
            }
            else {
                Reactotron.log('Selected Language: ' + selectedLanguage);
                this.setState({ lang: JSON.parse(selectedLanguage) });
                i18n.locale = JSON.parse(selectedLanguage).shortCode;
            }
        }

        this.translate = (key, config) => i18n.t(key, config);

        this.changeLanguage = async (lang) => {
            if (typeof lang !== 'object')
                lang = languages.find(element => element.shortCode === lang);
            Reactotron.log('previous selected language', this.state.lang);
            this.setState({ lang });
            await AsyncStorage.setItem('lang', JSON.stringify(lang));
            RNRestart.Restart();
        }

        this.cycleLanguages = () => {
            Reactotron.log('here', this.state.lang)
            let oldValue = this.state.lang.id;
            let newValue = oldValue >= languages.length - 1 ? 0 : oldValue + 1;
            Reactotron.log(oldValue, newValue)
            this.changeLanguage(languages[newValue]);
        }

        this.state = {
            lang: languages[0],
            languages,
            cycleLanguages: this.cycleLanguages,
            changeLanguage: this.changeLanguage,
            loadLanguage: this.loadLanguage,
            translate: this.translate
        }
    }

    render() {
        return (
            <LanguageContext.Provider value={this.state}>
                {this.props.children}
            </LanguageContext.Provider>
        )
    }
}

export const LanguageConsumer = LanguageContext.Consumer;
export {
    LanguageContext,
    i18n
}
