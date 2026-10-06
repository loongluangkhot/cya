# Spec Delta

## Purpose

Defines how the room's dock buttons show the state of features the viewer can switch on or off, so every toggle reads the same way at a glance and on hover.

## ADDED Requirements

### Requirement: On/off dock buttons show state by fill
Each dock button for a feature with an on/off setting (minds, music, mugshot, marquee) SHALL appear filled when the feature is on and plain when it is off. It SHALL use the same icon in both states and SHALL NOT dim when off.

#### Scenario: Feature turned on
- **WHEN** the viewer turns on music, mugshot, marquee or minds peeks
- **THEN** that feature's dock button appears filled

#### Scenario: Feature turned off
- **WHEN** the viewer turns one of those features off
- **THEN** its dock button appears plain, not dimmed, with the same icon it shows when on

#### Scenario: Marquee strip hidden
- **WHEN** marquee is on but its strip is hidden
- **THEN** the marquee dock button still appears filled

### Requirement: On/off dock buttons name their state on hover
Each on/off dock button SHALL show its feature name and current state on hover and in its accessible label, in the form "name · on" or "name · off". A button MAY show more specific status while on, for example a mugshot countdown or a marquee "strip hidden".

#### Scenario: Hover the minds button
- **WHEN** the viewer hovers the ✺ dock button
- **THEN** it reads "minds · on" or "minds · off", matching the Minds sheet toggle

#### Scenario: Hover a feature that is off
- **WHEN** the viewer hovers the music, mugshot or marquee button while that feature is off
- **THEN** it reads "<name> · off"
