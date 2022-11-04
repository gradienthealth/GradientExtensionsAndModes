const breastProtocol = {
    id: 'breast',
    locked: true,
    hasUpdatedPriorsInformation: false,
    name: 'Breast',
    createdDate: '2021-02-23T19:22:08.894Z',
    modifiedDate: '2021-02-23T19:22:08.894Z',
    availableTo: {},
    editableBy: {},
    protocolMatchingRules: [],
    displaySetSelectors: {
      LMLO: {
        seriesMatchingRules: [{
          "weight": 5,
          "attribute": "ImageLaterality",
          "constraint": {
            "contains": {
              "value": "L"
            }
          },
          "required": false
        }, {
          "weight": 5,
          "attribute": "ViewCodeSequence",
          "constraint": {
            "contains": {
              "value": "R-10226"
            }
          },
          "required": false
        }],
      },
      LCC: {
        seriesMatchingRules: [{
          "weight": 5,
          "attribute": "ImageLaterality",
          "constraint": {
            "contains": {
              "value": "L"
            }
          },
          "required": false
        }, {
          "weight": 5,
          "attribute": "ViewCodeSequence",
          "constraint": {
            "contains": {
              "value": "R-10242"
            }
          },
          "required": false
        }],
      },
      RMLO: {
        seriesMatchingRules: [{
          "weight": 5,
          "attribute": "ImageLaterality",
          "constraint": {
            "contains": {
              "value": "R"
            }
          },
          "required": false
        }, {
          "weight": 5,
          "attribute": "ViewCodeSequence",
          "constraint": {
            "contains": {
              "value": "R-10226"
            }
          },
          "required": false
        }],
      },
      RCC: {
        seriesMatchingRules: [{
          "weight": 5,
          "attribute": "ImageLaterality",
          "constraint": {
            "contains": {
              "value": "R"
            }
          },
          "required": false
        }, {
          "weight": 5,
          "attribute": "ViewCodeSequence",
          "constraint": {
            "contains": {
              "value": "R-10242"
            }
          },
          "required": false
        }],
      }
    },
    toolGroupIds: ['default'],
    stages: [
      {
        id: 'breast-staging',
        name: 'Breast Staging',
        viewportStructure: {
          type: 'grid',
          properties: {
            rows: 1,
            columns: 4,
          },
        },
        viewports: [
          {
            viewportOptions: {
              toolGroupId: 'default',
            },
            displaySets: [{ id: 'RMLO' }],
          },
          {
            viewportOptions: {
              toolGroupId: 'default',
            },
            displaySets: [{ id: 'LMLO' }],
          },
          {
            viewportOptions: {
              toolGroupId: 'default',
            },
            displaySets: [{ id: 'RCC' }],
          },
          {
            viewportOptions: {
              toolGroupId: 'default',
            },
            displaySets: [{ id: 'LCC' }],
          },
        ],
        createdDate: '2021-02-23T18:32:42.850Z',
      },
    ],
    numberOfPriorsReferenced: -1,
};

function getHangingProtocolModule() {
  return [
    {
      id: breastProtocol.id,
      protocol: breastProtocol,
    },
  ];
}

export default getHangingProtocolModule;
