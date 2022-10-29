# @gradienthealth&#x2F;ohif-gradienthealth-extension 
## Description 
Gradient Health Specific OHIF extension 

These dependencies need to be yarn linked from OHIF/Viewer

```
cd ./Viewers/platform/core && yarn unlink && yarn link && cd ../../..
cd ./Viewers/extensions/cornerstone && yarn unlink && yarn link && cd ../../..
cd ./Viewers/extensions/default && yarn unlink && yarn link && cd ../../..
cd ./Viewers/platform/i18n && yarn unlink && yarn link && cd ../../..
cd ./Viewers/platform/ui && yarn unlink && yarn link && cd ../../..
cd ./cornerstone3D-beta/packages/tools && yarn unlink && yarn link && cd ../../..
cd ./cornerstone3D-beta/packages/core && yarn unlink && yarn link && cd ../../..

cd ./GradientExtensionsAndModes/extensions/ohif-gradienthealth-extension
yarn link @ohif/core
yarn link @ohif/extension-cornerstone
yarn link @ohif/extension-default
yarn link @ohif/i18n
yarn link @ohif/ui
yarn link @cornerstonejs/tools
yarn link @cornerstonejs/core

yarn unlink @ohif/core
yarn unlink @ohif/extension-cornerstone
yarn unlink @ohif/extension-default
yarn unlink @ohif/i18n
yarn unlink @ohif/ui
yarn unlink @cornerstonejs/tools
yarn unlink @cornerstonejs/core
```
## Author 
Ouwen Huang 
## License 
MIT