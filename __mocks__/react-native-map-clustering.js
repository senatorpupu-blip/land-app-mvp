const React = require('react');

const ClusteredMapView = React.forwardRef((props, ref) => {
  React.useImperativeHandle(ref, () => ({
    fitToCoordinates: jest.fn(),
    animateToRegion: jest.fn(),
  }));
  return React.createElement('ClusteredMapView', { testID: 'mock-clustered-map-view', ...props }, props.children);
});
ClusteredMapView.displayName = 'ClusteredMapView';

module.exports = ClusteredMapView;
module.exports.default = ClusteredMapView;
