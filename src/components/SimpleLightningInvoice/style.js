import { StyleSheet, Dimensions } from 'react-native'

const grid = {
    unit: (Dimensions.get('screen').width / 3) / 7,
    headline: 32,
    title: 24,
    subheader: 18,
    body: 14,
    caption: 12,
    label: 10,
    lineHeight: 1.5,
    navIcon: 20,
    border: 2,
    borderRadius: 2,
    lowOpacity: 0.4,
    mediumOpacity: 0.6,
    highOpacity: 0.8
}

export default StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%'
    },
    viewTitle: {
        flexDirection: 'column',
        justifyContent: 'flex-end',
        alignItems: 'center',
        flex: 2
    },
    row: {
        alignItems: 'center',
        height: grid.unit * 5.5
    },
    colButtonCircle: {
        marginLeft: grid.unit / 2,
        marginRight: grid.unit / 2,
        alignItems: 'center',
        width: grid.unit * 6,
        height: grid.unit * 4
    },
    colEmpty: {
        marginLeft: grid.unit / 2,
        marginRight: grid.unit / 2,
        width: grid.unit * 6,
        height: grid.unit * 4
    },
    colIcon: {
        alignSelf: 'center',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column'
    },
    text: {
        fontSize: grid.unit * 2,
        fontWeight: '200'
    },
    buttonCircle: {
        alignItems: 'center',
        justifyContent: 'center',
        width: grid.unit * 6,
        height: grid.unit * 4,
        backgroundColor: 'rgb(242, 245, 251)',
        borderRadius: grid.unit * 2
    },
    textTitle: {
        fontSize: 20,
        fontWeight: '200',
        lineHeight: grid.unit * 2.5
    },
    textSubtitle: {
        fontSize: grid.unit,
        fontWeight: '200',
        textAlign: 'center'
    },
    flexCirclePassword: {
        flex: 2,
        justifyContent: 'center',
        alignItems: 'center'
    },
    topViewCirclePassword: {
        flexDirection: 'row',
        height: 'auto',
        justifyContent: 'center',
        alignItems: 'center'
    },
    viewCircles: {
        justifyContent: 'center',
        alignItems: 'center'
    },
    textDeleteButton: {
        fontWeight: '200',
        marginTop: 5
    },
    grid: {
        width: '100%',
        flex: 7,
    },
    priceText:{
        flex: 8,
        textAlign: 'right',
        fontSize: 72,
        fontWeight: 'bold',
        color: '#3d98ce'
    },
    currencySymbolText:{
        flex: 2,
        paddingLeft: 10,
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 64,
        fontWeight: 'bold',
        color: 'black'
    }
})