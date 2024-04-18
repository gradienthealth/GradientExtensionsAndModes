const getObjectVersions = async (
  bucket: string,
  fileName: string,
  headers: Record<string, string>
): Promise<Record<string, any>[]> => {
  const data = await fetch(
    `https://storage.googleapis.com/storage/v1/b/${bucket}/o?versions=true&prefix=${fileName}`,
    {
      method: 'GET',
      headers: headers,
    }
  ).then((response) => response.json());

  return data.items.filter((item) => item.name === fileName);
};

const getCurrentLiveVersion = async (
  bucket: string,
  fileName: string,
  headers: Record<string, string>
): Promise<Record<string, unknown> | undefined> => {
  const segDicomFileVersions = await getObjectVersions(
    bucket,
    fileName,
    headers
  );

  return segDicomFileVersions.find((version) => !version.timeDeleted);
};

const removeObjectsVersions = async (
  bucket: string,
  objectsVersionsAndFileNames: {
    fileName: string;
    version: Record<string, string>;
  }[],
  headers: Record<string, string>
): Promise<void> => {
  const promises = objectsVersionsAndFileNames.map(({ fileName, version }) => {
    return fetch(
      `https://storage.googleapis.com/${bucket}/${fileName}?generation=${version.generation}`,
      {
        method: 'DELETE',
        headers: { ...headers, 'Content-Type': 'application/json' },
      }
    ).catch((error) => {
      throw new Error(
        error.message || 'An error occured when deleting the version'
      );
    });
  });

  await Promise.all(promises);
};

const restoreObjectVersion = async (
  bucket: string,
  fileName: string,
  generation: number,
  headers: Record<string, string>
): Promise<void> => {
  const encodedFileName = encodeURIComponent(fileName);
  const url = `https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodedFileName}/rewriteTo/b/${bucket}/o/${encodedFileName}?sourceGeneration=${generation}`;
  await fetch(url, {
    method: 'POST',
    headers: { ...headers, 'Content-Length': '0' },
  }).catch((error) => {
    throw new Error(
      error.message || 'An error occured when restoring the version'
    );
  });
};

export {
  getObjectVersions,
  getCurrentLiveVersion,
  removeObjectsVersions,
  restoreObjectVersion,
};
