const React = require('react');

const View = (props) => React.createElement('View', props, props.children);
const Text = (props) => React.createElement('Text', props, props.children);
const TouchableOpacity = (props) => React.createElement('TouchableOpacity', props, props.children);
const SafeAreaView = (props) => React.createElement('SafeAreaView', props, props.children);
const ActivityIndicator = (props) => React.createElement('ActivityIndicator', props);
const Switch = (props) => React.createElement('Switch', props);
const StyleSheet = {
  create: (styles) => styles,
};
const Dimensions = {
  get: () => ({ width: 375, height: 812 }),
};
const Platform = {
  OS: 'ios',
  select: (obj) => obj.ios || obj.default,
};

module.exports = {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Switch,
  StyleSheet,
  Dimensions,
  Platform,
};
