"""Regression checks for lossy or fabricated nationwide bath data imports."""
import importlib.util
import pathlib
import unittest

spec = importlib.util.spec_from_file_location('inventory', pathlib.Path(__file__).with_name('assemble-sauna-inventory.py'))
inventory = importlib.util.module_from_spec(spec)
spec.loader.exec_module(inventory)


class InventoryTest(unittest.TestCase):
    def fixture(self, **changes):
        row = dict(id='node/1', name='松の湯', prefecture='東京都', city='台東区', address='東京都台東区浅草1丁目4番14号', phone='', lat=35.71, lon=139.79)
        return dict(row, **changes)

    def test_distinct_names_and_addresses(self):
        self.assertFalse(inventory.same_facility(self.fixture(), self.fixture(id='way/2', city='文京区')))
        self.assertFalse(inventory.same_facility(self.fixture(name='名称未登録'), self.fixture(id='way/2', name='名称未登録', address='', lat=35.71001)))
        self.assertNotEqual(inventory.address_key('東京都台東区浅草1-4-14', '東京都'), inventory.address_key('東京都台東区浅草1-41-4', '東京都'))
        self.assertTrue(inventory.same_facility(self.fixture(), self.fixture(id='way/2', address='台東区浅草1-4-14', lat=35.71001)))

    def test_weekdays_are_not_invented_24_hour_schedules(self):
        row = inventory.normalize_row(dict(self.fixture(), hours='Tu-Su', sourceUrl='https://www.openstreetmap.org/node/1'), 'osm', dict(fetchedAt='2026-09-20T00:00:00Z', sourceDate='2026-09-19'))
        self.assertEqual(row['hours'], '')
        self.assertEqual(row['hoursText'], '')
        self.assertEqual(row['checkedAt'], '')
        self.assertTrue(row['inventoryOnly'])
        self.assertIn('火-日', row['closedText'])

    def test_prose_hours_and_conditions_keep_their_scope(self):
        row = inventory.normalize_row(dict(self.fixture(), hoursText='平日 10:00〜22:00', fetchedAt='2026-09-20T00:00:00Z', sourceUrl='https://example.org/bath', closurePeriods=[{'from':'2026-10-01','through':'2026-10-03'}]), 'official', {})
        self.assertEqual(row['hours'], '')
        self.assertTrue(row['manualCalendar'])
        self.assertEqual(row['checkedAt'], '2026-09-20T00:00:00Z')
        self.assertEqual(row['closurePeriods'][0]['through'], '2026-10-03')
        restricted = inventory.normalize_row(dict(self.fixture(), tags={'reservation':'required','note':'長期間の休業中、再開の目処なし'}, sourceUrl='https://www.openstreetmap.org/node/1'), 'osm', {})
        self.assertEqual(restricted['access'], 'permit')
        self.assertEqual(restricted['status'], 'inactive')


if __name__ == '__main__':
    unittest.main()
