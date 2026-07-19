import http.client
import json
import os
import tempfile
import threading
import unittest

import start_server


class ManagedFileTests(unittest.TestCase):
    def test_managed_file_path_stays_inside_root(self):
        with tempfile.TemporaryDirectory() as root_dir:
            safe_name, file_path = start_server.resolve_managed_file(
                root_dir,
                '../../outside',
                '.txt',
            )

            self.assertEqual(safe_name, 'outside.txt')
            self.assertEqual(
                os.path.commonpath((os.path.realpath(root_dir), file_path)),
                os.path.realpath(root_dir),
            )

    def test_managed_filename_preserves_unicode_and_normalizes_extension(self):
        safe_name = start_server.safe_managed_filename('比赛歌单.TXT', '.txt')
        self.assertEqual(safe_name, '比赛歌单.TXT')


class ServerSecurityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.httpd = start_server.ThreadingTCPServer(
            (start_server.SERVER_HOST, 0),
            start_server.Handler,
        )
        cls.port = cls.httpd.server_address[1]
        cls.server_thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.server_thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()
        cls.server_thread.join(timeout=5)

    def request(self, method, path, body=None, headers=None):
        connection = http.client.HTTPConnection(start_server.SERVER_HOST, self.port, timeout=5)
        try:
            connection.request(method, path, body=body, headers=headers or {})
            response = connection.getresponse()
            payload = response.read()
            return response.status, response.headers, payload
        finally:
            connection.close()

    def test_server_is_bound_to_loopback(self):
        self.assertEqual(self.httpd.server_address[0], start_server.SERVER_HOST)
        self.assertEqual(start_server.SERVER_HOST, '127.0.0.1')

    def test_api_response_does_not_enable_cross_origin_access(self):
        status, headers, _ = self.request('GET', '/api/reset-state')
        self.assertEqual(status, 200)
        self.assertIsNone(headers.get('Access-Control-Allow-Origin'))

    def test_oversized_request_is_rejected_before_body_read(self):
        status, _, payload = self.request(
            'POST',
            '/api/create-file',
            body=b'',
            headers={
                'Content-Type': 'application/json',
                'Content-Length': str(start_server.MAX_REQUEST_BODY_BYTES + 1),
            },
        )

        self.assertEqual(status, 413)
        response = json.loads(payload.decode('utf-8'))
        self.assertFalse(response['success'])

    def test_random_music_file_list_only_contains_txt_files(self):
        original_dir = start_server.random_music_txt_dir
        with tempfile.TemporaryDirectory() as random_dir:
            with open(os.path.join(random_dir, '比赛池.txt'), 'w', encoding='utf-8') as file_obj:
                file_obj.write('8,17')
            with open(os.path.join(random_dir, 'ignore.json'), 'w', encoding='utf-8') as file_obj:
                file_obj.write('{}')

            start_server.random_music_txt_dir = random_dir
            try:
                status, _, payload = self.request('GET', '/api/get-random-music-files')
            finally:
                start_server.random_music_txt_dir = original_dir

        self.assertEqual(status, 200)
        response = json.loads(payload.decode('utf-8'))
        self.assertEqual([item['name'] for item in response['files']], ['比赛池.txt'])


if __name__ == '__main__':
    unittest.main()
