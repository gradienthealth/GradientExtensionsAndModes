// TODO: Pull in IWebClientApi from @ohif/core
// TODO: Use constructor to create an instance of IWebClientApi
// TODO: Use existing DICOMWeb configuration (previously, appConfig, to configure instance)

import { createDicomJSONApi } from './DicomJSONDataSource/index.js';

/**
 *
 */
function getDataSourcesModule({servicesManager}) {
  return [
    {
      name: 'bq',
      type: 'jsonApi',
      createDataSource: dicomJsonConfig => {
        return createDicomJSONApi(dicomJsonConfig, servicesManager);
      },
    },
  ];
}

export default getDataSourcesModule;
