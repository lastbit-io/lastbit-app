import { StyleSheet } from 'react-native'

export default function (theme) {
    return StyleSheet.create({
        boxReceiveImage: {
            width: 15,
            height: 15,
            marginHorizontal: 5,
            resizeMode: 'contain',
            tintColor: theme.COLOR_SUCCESS
        },
        boxSendImage: {
            width: 15,
            height: 15,
            marginHorizontal: 5,
            resizeMode: 'contain',
            tintColor: theme.COLOR_ERROR
        },
        boxDepositImage:{
            width: 25,
            height: 25,
            resizeMode: 'contain',
            tintColor: theme.COLOR_SUCCESS
        },
        boxWithdrawImage:{
            width: 25,
            height: 25,
            resizeMode: 'contain',
            tintColor: theme.COLOR_ERROR
        },
        transactionTimeText: {
            fontFamily: 'Quicksand-Medium',
            color: theme.SECONDARY_COLOR,
            marginLeft: 15
        },
        transactionContainer: {
            justifyContent: 'space-between',
            padding: 10,
            paddingHorizontal: 20,
            flexDirection: 'row',
            borderBottomColor: theme.PRIMARY_LIST_SEPARATOR_COLOR,
            borderBottomWidth: 1
        },
    })
}