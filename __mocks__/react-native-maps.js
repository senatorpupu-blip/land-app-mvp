const React = require('react');

const MockMapView = React.forwardRef((props, ref) => {
  React.useImperativeHandle(ref, () => ({
    fitToCoordinates: jest.fn(),
    animateToRegion: jest.fn(),
  }));
  return React.createElement('MapView', { testID: 'mock-map-view', ...props }, props.children);
});
MockMapView.displayName = 'MockMapView';

const Marker = (props) => React.createElement('Marker', { testID: 'mock-marker', ...props });
const UrlTile = (props) => React.createElement('UrlTile', { testID: 'mock-url-tile', ...props });

module.exports = {
  __esModule: true,
  default: MockMapView,
  Marker,
  UrlTile,
  PROVIDER_GOOGLE: 'google',
};
